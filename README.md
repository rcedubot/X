# Baileys Zero

A lightweight and modern WhatsApp Web library built on WebSockets for Node.js.

## Features 🚀

- WhatsApp Web connectivity
- QR & Pairing Code authentication
- Message sending and receiving
- Group management
- Media handling
- Event-driven architecture
- TypeScript support
- Node.js 20+ support

### Authentication
- QR Code Login
- Pairing Code Login
- Multi File Auth State
- Session Restore Support
- Custom Auth Storage Support
- MongoDB Auth Support

### Messaging
- Send Text Messages
- Send Images
- Send Videos
- Send Audio & Voice Notes
- Send Documents
- Send Stickers
- Send Contacts
- Send Locations
- Send Live Locations
- Send Polls
- Send Reactions
- Send Mentions
- Forward Messages
- Quote Messages

### Interactive Messages
- Quick Reply Buttons
- List Messages
- Native Flow Messages
- CTA URL Buttons
- Copy Code Buttons
- Call Buttons
- Single Select Menus
- Interactive Media Messages
- Flow Messages

### Groups
- Create Groups
- Update Group Settings
- Manage Participants
- Group Metadata Support
- Group Invite Messages
- Admin Invite Messages

###  Newsletters
- Newsletter Management
- Newsletter Message Send Support 

### Broadcast & Status
- Send Status Updates
- Send Broadcast Messages
- Query Broadcast Lists
- Story Support

### Data Management
- In-Memory Store
- Message Caching
- Group Metadata Caching
- Chat Storage
- Contact Storage
- Session Backup

## Package Information

| Field | Value |
|---------|---------|
| Name | baileys_zero |
| Version | 1.2.0 |
| License | MIT |
| Module Type | ESM |
| Node.js | >= 20.0.0 |

## Main Dependencies

- @cacheable/node-cache
- @hapi/boom
- async-mutex
- libsignal
- lru-cache
- music-metadata
- pino
- protobufjs
- whatsapp-rust-bridge
- ws

## Authentication

Supports:

- QR Code Login
- Pairing Code Login
- Multi-file Auth State

## Installation

```bash
npm install baileys_zero
```

## Quick Start

```js
import makeWASocket from 'baileys_zero'

const sock = makeWASocket({
    printQRInTerminal: true
})

sock.ev.on('messages.upsert', ({ messages }) => {
    console.log(messages)
})
```


    ```
## Saving & Restoring Sessions

You obviously don't want to keep scanning the QR code every time you want to connect. 

So, you can load the credentials to log back in:
```ts
import makeWASocket, { useMultiFileAuthState } from 'baileys_zero'

const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')

// will use the given state to connect
// so if valid credentials are available -- it'll connect without QR
const sock = makeWASocket({ auth: state })

// this will be called as soon as the credentials are updated
sock.ev.on('creds.update', saveCreds)
```

> [!IMPORTANT]
> `useMultiFileAuthState` is a utility function to help save the auth state in a single folder, this function serves as a good guide to help write auth & key states for SQL/no-SQL databases, which I would recommend in any production grade system.

> [!NOTE]
> When a message is received/sent, due to signal sessions needing updating, the auth keys (`authState.keys`) will update. Whenever that happens, you must save the updated keys (`authState.keys.set()` is called). Not doing so will prevent your messages from reaching the recipient & cause other unexpected consequences. The `useMultiFileAuthState` function automatically takes care of that, but for any other serious implementation -- you will need to be very careful with the key state management.


## Handling Events

- Baileys uses the EventEmitter syntax for events. 
They're all nicely typed up, so you shouldn't have any issues with an Intellisense editor like VS Code.


You can listen to these events like this:
```ts
const sock = makeWASocket()
sock.ev.on('messages.upsert', ({ messages }) => {
    console.log('got messages', messages)
})
```

```js
sock.ev.on('connection.update', console.log)
sock.ev.on('messages.upsert', console.log)
sock.ev.on('creds.update', console.log)
```


### Example to Start

> [!NOTE]
> This example includes basic auth storage too

```ts
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from 'baileys_zero'
import { Boom } from '@hapi/boom'

async function connectToWhatsApp () {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys')
    const sock = makeWASocket({
        // can provide additional config here
        auth: state,
        printQRInTerminal: true
    })
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect)
            // reconnect if not logged out
            if(shouldReconnect) {
                connectToWhatsApp()
            }
        } else if(connection === 'open') {
            console.log('opened connection')
        }
    })
    sock.ev.on('messages.upsert', event => {
        for (const m of event.messages) {
            console.log(JSON.stringify(m, undefined, 2))

            console.log('replying to', m.key.remoteJid)
            await sock.sendMessage(m.key.remoteJid!, { text: 'Hello Word' })
        }
    })

    // to storage creds (session info) when it updates
    sock.ev.on('creds.update', saveCreds)
}
// run in main file
connectToWhatsApp()
```

### For example if you use useSingleFileAuthState and useMongoFileAuthState
```ts
import makeWASocket, { useSingleFileAuthState, useMongoFileAuthState } from 'baileys_zero'

// Single Auth
const { state, saveState } = await useSingleFileAuthState('./auth_info_baileys.json') 
const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    })
    
sock.ev.on('creds.update', saveState)

// Mongo Auth
import { MongoClient } from "mongodb"

const connectAuth = async() => {
    global.client = new MongoClient('mongoURL')
    global.client.connect(err => {
        if (err) {
            console.warn("Warning: MongoDB link is invalid or cannot be connected.")
        } else {
            console.log('Successfully Connected To MongoDB Server')
        }
    })
}
  await client.connect()
  const collection = client.db("@itsockchann").collection("sessions")
  return collection
}

const Authentication = await connectAuth()
const { state, saveCreds } = await useMongoFileAuthState(Authentication)
const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    })
    
sock.ev.on('creds.update', saveCreds)
```

> [!IMPORTANT]
> In `messages.upsert` it's recommended to use a loop like `for (const message of event.messages)` to handle all messages in array


## Authors

| Author | Community |
| :--- | :--- |
| **Rashmika** | [𝙓𝙋𝙍𝙊𝙑𝙚𝙧𝙨𝙚 𝙊𝙁𝘾](https://whatsapp.com/channel/0029VbBbldUJ93wbCIopwf2m) |
| **Rocky** | [𝛯𝛭𝐼𝚴𝛯𝚴𝐶𝛯 亇𝛯𝐶𝐻](https://whatsapp.com/channel/0029Vb6X1kv0Qeabrr1Dlp03) |

## License

MIT