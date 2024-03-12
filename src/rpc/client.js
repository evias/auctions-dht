'use strict'

import RPC from '@hyperswarm/rpc'
import DHT from 'hyperdht'
import Hypercore from 'hypercore'
import Hyperbee from 'hyperbee'
import crypto from 'hypercore-crypto'

export class RPCClient {

  constructor(
    serverPublicKey,
    port = 50001
  ) {
    this.serverPublicKey = serverPublicKey;
    this.port = port;
    this.backend = new Hypercore(Pear.config.storage + '/rpc-client')
    this.storage = new Hyperbee(this.backend, { keyEncoding: 'utf-8', valueEncoding: 'binary' })
  }

  async connect()
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

    // start distributed hash table, it is used for rpc service discovery
    this.dht = new DHT({
      port: this.port,
      keyPair: DHT.keyPair(dhtSeed),
      bootstrap: [{ host: '127.0.0.1', port: 50153 }] // note boostrap points to dht that is started via cli
    })
    await this.dht.ready()

    // rpc lib
    this.rpc = new RPC({ dht: this.dht })
    console.log('[CLIENT] connected to public key:', this.serverPublicKey.toString('hex'))
    // [CLIENT] connected to public key: 763cdd329d29dc35326865c4fa9bd33a45fdc2d8d2564b11978ca0d022a44a19
  }

  async disconnect()
  {
    // closing connection
    await this.rpc.destroy()
    await this.dht.destroy()
  }

  async ping()
  {
    console.log('[CLIENT] requesting PING to public key:', this.serverPublicKey.toString('hex'))

    // payload for request
    const payload = { nonce: 152 }
    const payloadRaw = Buffer.from(JSON.stringify(payload), 'utf-8')

    // sending request and handling response
    const responseBuffer = await this.rpc.request(this.serverPublicKey, 'ping', payloadRaw)
    const response = this.parseBuffer(responseBuffer)
    console.log("[CLIENT] response: ", response) // { nonce: 153 }
    return response;
  }

  async create(title, amount, attachment)
  {
    console.log('[CLIENT] requesting CREATE to public key:', this.serverPublicKey.toString('hex'))

    const responseBuffer = await this.rpc.request(this.serverPublicKey, 'create', this.toBuffer({
      title,
      amount,
      attachment: attachment
    }))
    const response = this.parseBuffer(responseBuffer)
    console.log("[CLIENT] response: ", response) // { status: 0, message: 'OK' }
    return response;
  }

  async join(title)
  {
    console.log('[CLIENT] requesting JOIN to public key:', this.serverPublicKey.toString('hex'))

    const responseBuffer = await this.rpc.request(this.serverPublicKey, 'join', this.toBuffer({
      title,
    }))
    const response = this.parseBuffer(responseBuffer)
    console.log("[CLIENT] response: ", response) // { status: 0, id: '...', auction: {} }
    return response;
  }

  async leave(title)
  {
    console.log('[CLIENT] requesting LEAVE to public key:', this.serverPublicKey.toString('hex'))

    const responseBuffer = await this.rpc.request(this.serverPublicKey, 'leave', this.toBuffer({
      title,
    }))
    const response = this.parseBuffer(responseBuffer)
    console.log("[CLIENT] response: ", response) // { status: 0, message: 'OK' }
    return response;
  }

  async auction(title, amount)
  {
    console.log('[CLIENT] requesting AUCTION to public key:', this.serverPublicKey.toString('hex'))

    const responseBuffer = await this.rpc.request(this.serverPublicKey, 'auction', this.toBuffer({
      title,
      amount,
    }))
    const response = this.parseBuffer(responseBuffer)
    console.log("[CLIENT] response: ", response) // { status: 0, message: 'OK' }
    return response;
  }

  async settle(title)
  {
    console.log('[CLIENT] requesting SETTLE to public key:', this.serverPublicKey.toString('hex'))

    const responseBuffer = await this.rpc.request(this.serverPublicKey, 'settle', this.toBuffer({
      title,
    }))
    const response = this.parseBuffer(responseBuffer)
    console.log("[CLIENT] response: ", response) // { status: 0, amount: 0 }
    return response;
  }

  toBuffer(json)
  {
    return Buffer.from(JSON.stringify(json), 'utf-8')
  }

  parseBuffer(buffer)
  {
    return JSON.parse(buffer.toString('utf-8'))
  }
}
