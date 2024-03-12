'use strict'

import b4a from 'b4a'
import RPC from '@hyperswarm/rpc'
import DHT from 'hyperdht'
import Hyperswarm from 'hyperswarm'
import Hypercore from 'hypercore'
import Hyperbee from 'hyperbee'
import crypto from 'hypercore-crypto'

function hash (value) {
  return crypto.data(Buffer.from(value, 'utf-8'))
}

export class RPCServer {

  constructor(
    port,
    onDataReceived = (m) => console.log(`${m}`),
    onPeerConnected = () => console.log(`onPeerConnected`)
  ) {
    this.port = port;
    this.backend = new Hypercore(Pear.config.storage + '/rpc-server')
    this.storage = new Hyperbee(this.backend, { keyEncoding: 'utf-8', valueEncoding: 'binary' })

    this.onDataReceived = onDataReceived;
    this.onPeerConnected = onPeerConnected;
  }

  async start()
  {
    // hyperbee db
    await this.storage.ready()

    // resolve distributed hash table seed by key pair
    let dhtSeed = (await this.storage.get('dht-seed'))?.value
    if (!dhtSeed) {
      // not found, generate in place
      dhtSeed = crypto.randomBytes(32)
      await this.storage.put('dht-seed', dhtSeed)
    }

    this.keyPair = DHT.keyPair(dhtSeed)

    // start distributed hash table, it is used for rpc service discovery
    this.dht = new DHT({
      port: this.port,
      keyPair: this.keyPair,
      bootstrap: [{ host: '127.0.0.1', port: 50153 }] // note boostrap points to dht that is started via cli
    })

    await this.dht.ready()

    this.network = new Hyperswarm({ dht: this.dht })

    Pear.teardown(() => this.network.destroy())

    // When there's a new connection, listen for new messages, and add them to the UI
    this.network.on('connection', (peer) => {
      const name = b4a.toString(peer.remotePublicKey, 'hex').substr(0, 8)
      this.onDataReceived(name, 'Connection established')
      this.onPeerConnected(this)

      peer.on('data', async (message) => {
        try {
          const operation = JSON.parse(message)
          if (!operation || !operation.command) {
            this.onDataReceived(name, message)
            return
          }

          // only handle commands if storage for this
          // auction room is available on this node
          const room = operation.room
          const has_in_bee = (await this.storage.get(room))?.value
          if (! has_in_bee) return;

          // retrieve the JSON data
          const auction_json = (await this.storage.get(has_in_bee.toString('hex')))?.value
          if (! auction_json) return
          const auction = JSON.parse(auction_json)

          switch (operation.command) {
            default:
            case 'auction':
              // update the highestBid (obvs should be "latestBid")
              auction.highestBid = operation.amount
              await this.storage.put(has_in_bee.toString('hex'), JSON.stringify(auction))
              this.onDataReceived(name, `New highest bid of ${operation.amount} USDt`)
              break

            case 'settle':
              // update the status
              auction.status = 'SETTLED'
              await this.storage.put(has_in_bee.toString('hex'), JSON.stringify(auction))
              this.onDataReceived(name, `Auction settled for ${auction.highestBid} USDt`)
              break
          }
        }
        catch(e) {}
      })

      peer.on('error', e => console.log(`Connection error: ${e}`))
    })

    this.network.on('update', () => this.onPeerConnected(this))

    // start RPC server and listen for RPC requests from clients
    const serverPubKey = await this.listen()
    return serverPubKey;
  }

  async listen()
  {
    // resolve rpc server seed for key pair
    let rpcSeed = (await this.storage.get('rpc-seed'))?.value
    if (!rpcSeed) {
      rpcSeed = crypto.randomBytes(32)
      await this.storage.put('rpc-seed', rpcSeed)
    }

    // setup rpc server
    const rpc = new RPC({ seed: rpcSeed, dht: this.network.dht })
    this.server = rpc.createServer()

    await this.server.listen()
    const serverPublicKey = this.server.publicKey
    console.log('[SERVER] started listening on public key:', serverPublicKey.toString('hex'))
    // [SERVER] started listening on public key: 763cdd329d29dc35326865c4fa9bd33a45fdc2d8d2564b11978ca0d022a44a19

    // bind handlers to rpc server

// PING
    this.server.respond('ping', async (reqRaw) => {
      console.log('[SERVER] intercepted PING command')
      const req = JSON.parse(reqRaw.toString('utf-8'))
      const resp = { nonce: req.nonce + 1 }
      return this.toBuffer(resp)
    })

// CREATE (title, amount, uploadBuffer)
    this.server.respond('create', async (reqRaw) => {
      console.log('[SERVER] intercepted CREATE command')

      const req = JSON.parse(reqRaw.toString('utf-8'))

      // request validation
      if (!req.title || !req.amount || !req.attachment) {
        return this.toBuffer({
          status: 1,
          message: 'Missing mandatory fields for CREATE (title, amount, attachment)'
        })
      }

      // hash the title as the auction identifier
      const titleHash = crypto.data(Buffer.from(req.title, 'utf-8'))

      const auction = {
        owner: serverPublicKey.toString('hex'),
        id: titleHash.toString('hex'),
        minimumBid: req.amount,
        highestBid: 0,
        status: 'OPEN'
      }

      // the auction hash is used to retrieve the auction from DHT
      const auctionHash = hash(JSON.stringify(auction));
      console.log('[SERVER] auction.id = ', auction.id)
      console.log('[SERVER] auctionHash = ', auctionHash.toString('hex'))

      // save data to storage
      await this.storage.put(auctionHash.toString('hex'), JSON.stringify(auction))
      await this.storage.put(titleHash.toString('hex'), auctionHash)

      // join the auction room and wait for it to be announced on DHT
      const channel = this.network.join(titleHash, { client: true, server: true })
      await channel.flushed()

      return this.toBuffer({
        status: 0,
        message: 'OK'
      })
    })

// JOIN (title)
    this.server.respond('join', async (reqRaw) => {
      console.log('[SERVER] intercepted JOIN command')

      const req = JSON.parse(reqRaw.toString('utf-8'))

      // request validation
      if (!req.title) {
        return this.toBuffer({
          status: 1,
          message: 'Missing mandatory fields for JOIN (title)'
        })
      }

      // join discovery channel
      const titleHash = crypto.data(Buffer.from(req.title, 'utf-8'))

      // join the auction room and wait for status to be announced on DHT
      const channel = this.network.join(titleHash, { client: true, server: true })
      await channel.flushed()

      return this.toBuffer({
        status: 0,
        id: titleHash.toString('hex')
      })
    })

// LEAVE (title)
    this.server.respond('leave', async (reqRaw) => {
      console.log('[SERVER] intercepted LEAVE command')

      const req = JSON.parse(reqRaw.toString('utf-8'))

      // request validation
      if (!req.title) {
        return this.toBuffer({
          status: 1,
          message: 'Missing mandatory fields for LEAVE (title)'
        })
      }

      // join channel
      const channelId = crypto.data(Buffer.from(req.title, 'utf-8'))
      await this.network.leave(channelId)

      return this.toBuffer({
        status: 0,
        id: channelId.toString('hex')
      })
    })

    // AUCTION (title, amount)
    this.server.respond('auction', async (reqRaw) => {
      console.log('[SERVER] intercepted AUCTION command')

      const req = JSON.parse(reqRaw.toString('utf-8'))

      // request validation
      if (!req.title || !req.amount) {
        return this.toBuffer({
          status: 1,
          message: 'Missing mandatory fields for AUCTION (title, amount)'
        })
      }

      // .. and tell neighbours
      const roomId = crypto.data(Buffer.from(req.title, 'utf-8'))
      const peers = [...this.network.connections]
      for (const peer of peers) peer.write(JSON.stringify({ command: 'auction', room: roomId.toString('hex'), amount: req.amount }))

      return this.toBuffer({
        status: 0,
        title: req.title,
        amount: req.amount
      })
    })

    // SETTLE (title, amount)
    this.server.respond('settle', async (reqRaw) => {
      console.log('[SERVER] intercepted SETTLE command')

      const req = JSON.parse(reqRaw.toString('utf-8'))

      // request validation
      if (!req.title) {
        return this.toBuffer({
          status: 1,
          message: 'Missing mandatory fields for SETTLE (title)'
        })
      }

      // .. and tell neighbours
      const roomId = crypto.data(Buffer.from(req.title, 'utf-8'))
      const peers = [...this.network.connections]
      for (const peer of peers) {
        peer.write(JSON.stringify({ command: 'settle', room: roomId.toString('hex') }))
      }

      return this.toBuffer({
        status: 0
      })
    })

    //XXX CANCEL

    return serverPublicKey
  }

  toBuffer(json)
  {
    return Buffer.from(JSON.stringify(json), 'utf-8')
  }
}
