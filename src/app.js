'use strict'

import ui from './ui/main'

// ---------------
// Part 1: Initialize the RPC service
import { RPCServer } from './rpc/server'
import { RPCClient } from './rpc/client'

let rpc_server, rpc_client;

(async () => {

  // start RPC server
  rpc_server = new RPCServer(40001, ui.dataToFeed, ui.updatePeersCount)
  const serverPub = await rpc_server.start()

  // connect client to server
  rpc_client = new RPCClient(serverPub, 50001)
  await rpc_client.connect()

  // execute one ping for testing
  await rpc_client.ping()

})().catch(console.error)

// ---------------
// Part 2: Setting up the UI

document.querySelector('#upload-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  await ui.submitUploadForm(rpc_client)
})

document.querySelector('#join-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  await ui.submitJoinForm(rpc_client)
})

document.querySelector('#leave-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  await ui.submitLeaveForm(rpc_client)
})

document.querySelector('#auction-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  await ui.submitAuctionForm(rpc_client)
})

document.querySelector('#settle-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  await ui.submitSettleForm(rpc_client)
})

// ---------------
// Part 3: Setting up the teardown process

window.onbeforeunload = async function()
{
  if (rpc_client) {
    await rpc_client.disconnect();
  }
}

