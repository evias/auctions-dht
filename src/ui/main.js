'use strict'

// Adds a data row to the feed
function dataToFeed(publicKey, message)
{
  const $div = document.createElement('div')
  $div.textContent = `<${publicKey}> ${message}`
  document.querySelector('#feed').appendChild($div)
}

// Updates the peers count
// @param {AuctionsHouse} swarm
function updatePeersCount(swarm)
{
  // update peers count
  document.querySelector('#peers-count').textContent = swarm.network.connections.size
}

// Submits the upload form (to create new auctions)
// @param {RPCClient} client
async function submitUploadForm(client)
{
  const title = document.querySelector('#title').value
  const price = document.querySelector('#price').value
  const attachment = document.querySelector('#attachment').files[0]

  document.querySelector('#error-message').classList.add('hidden')
  document.querySelector('#loading').classList.remove('hidden')

  // read attachment and communicate using RPC
  const reader = new FileReader()

  reader.onload = async function() {
    // RPC Client (CREATE)
    const response = await client.create(title, price, reader.result)

    document.querySelector('#loading').classList.add('hidden')

    if (response.status === 0) {
      document.querySelector('#current-topic').innerText = title
      document.querySelector('#setup').classList.add('hidden')
      document.querySelector('#auction-form').classList.add('hidden')
      document.querySelector('#orderbook').classList.remove('hidden')
    }
    else {
      document.querySelector('#error-message').innerText = response.message;
      document.querySelector('#error-message').classList.remove('hidden')
    }
  }

  reader.readAsText(attachment)
}

// Submit the room join form
// @param {RPCClient} client
async function submitJoinForm(client)
{
  const title = document.querySelector('#room').value

  document.querySelector('#not-found-message').classList.add('hidden')
  document.querySelector('#loading').classList.remove('hidden')

  // RPC Client (JOIN)
  const response = await client.join(title)

  document.querySelector('#loading').classList.add('hidden')

  if (response.status === 0) {
    document.querySelector('#current-topic').innerText = title
    document.querySelector('#setup').classList.add('hidden')
    document.querySelector('#settle-form').classList.add('hidden')
    document.querySelector('#orderbook').classList.remove('hidden')
  }
  else {
    document.querySelector('#not-found-message').classList.remove('hidden')
  }
}

// Submit the form to go back to homescreen
// @param {RPCClient} client
async function submitLeaveForm(client)
{
  const title = document.querySelector('#current-topic').innerText

  document.querySelector('#loading').classList.remove('hidden')

  // RPC Client (LEAVE)
  const response = await client.leave(title)

  document.querySelector('#orderbook').classList.add('hidden')
  document.querySelector('#loading').classList.add('hidden')
  document.querySelector('#setup').classList.remove('hidden')
}

async function submitAuctionForm(client)
{
  const title = document.querySelector('#current-topic').innerText
  const amount = document.querySelector('#amount').value

  // RPC Client (OFFER)
  const response = await client.auction(title, amount)
  dataToFeed('You', 'placed an offer for ' + amount + ' USDt')
}

// Submit the form to settle an auction
// @param {RPCClient} client
async function submitSettleForm(client)
{
  const title = document.querySelector('#current-topic').innerText

  // RPC Client (SETTLE)
  const response = await client.settle(title)
}

export default {
  dataToFeed,
  updatePeersCount,
  submitUploadForm,
  submitJoinForm,
  submitLeaveForm,
  submitAuctionForm,
  submitSettleForm,
}
