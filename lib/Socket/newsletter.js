import { QueryIds, XWAPaths } from '../Types/index.js';
import { generateProfilePicture } from '../Utils/messages-media.js';
import { getBinaryNodeChild } from '../WABinary/index.js';
import { makeGroupsSocket } from './groups.js';
import { executeWMexQuery as genericExecuteWMexQuery } from './mex.js';

const parseNewsletterCreateResponse = (response) => {
    const { id, thread_metadata: thread, viewer_metadata: viewer } = response;
    return {
        id,
        owner: undefined,
        name: thread.name.text,
        creation_time: parseInt(thread.creation_time, 10),
        description: thread.description.text,
        invite: thread.invite,
        subscribers: parseInt(thread.subscribers_count, 10),
        verification: thread.verification,
        picture: {
            id: thread.picture.id,
            directPath: thread.picture.direct_path
        },
        mute_state: viewer.mute
    };
};

const parseNewsletterMetadata = (result) => {
    if (typeof result !== 'object' || result === null) return null;
    if ('id' in result && typeof result.id === 'string') return result;
    if (
        'result' in result &&
        typeof result.result === 'object' &&
        result.result !== null &&
        'id' in result.result
    ) {
        return result.result;
    }
    return null;
};

export const makeNewsletterSocket = (config) => {
    const sock = makeGroupsSocket(config);
    const { query, generateMessageTag } = sock;
    
    const executeWMexQuery = (variables, queryId, dataPath) => {
        return genericExecuteWMexQuery(variables, queryId, dataPath, query, generateMessageTag);
    };

    const newsletterUpdate = async (jid, updates) => {
        const variables = {
            newsletter_id: jid,
            updates: { ...updates, settings: null }
        };
        return executeWMexQuery(variables, QueryIds.UPDATE_METADATA, 'xwa2_newsletter_update');
    };

    const _sendNewsletterNode = async (jid, encodedBytes, msgId, extraAttrs = {}) => {
        const stanza = {
            tag: 'message',
            attrs: {
                to: jid,
                id: msgId,
                type: 'text',
                ...extraAttrs
            },
            content: [
                {
                    tag: 'plaintext',
                    attrs: {},
                    content: encodedBytes
                }
            ]
        };
        await query(stanza);
    };

    // Unified send function for all newsletter message types
    const newsletterSend = async (jid, content, waUploadToServer, options = {}) => {
        const { encodeNewsletterMessage, generateMessageIDV2, prepareWAMessageMedia } =
            await import('../Utils/index.js');
        
        const msgId = options.messageId || generateMessageIDV2(sock.user?.id);
        
        let encoded;
        let resultMessage;
        
        // Handle different content types
        if (typeof content === 'string') {
            // Simple text message
            const message = { conversation: content };
            encoded = encodeNewsletterMessage(message);
            resultMessage = message;
        } else if (content.text) {
            // Text message with options
            const message = { conversation: content.text };
            encoded = encodeNewsletterMessage(message);
            resultMessage = message;
        } else if (content.image || content.video || content.audio || content.document || content.sticker) {
            // Media message
            const mediaMsg = await prepareWAMessageMedia(content, {
                upload: waUploadToServer,
                logger: config.logger,
                mediaCache: config.mediaCache,
                options: config.options,
                jid 
            });
            encoded = encodeNewsletterMessage(mediaMsg);
            resultMessage = mediaMsg;
        } else if (content.buttons || content.interactiveMessage) {
            // Buttons/interactive message
            const { proto } = await import('../../WAProto/index.js');
            
            const interactiveMessage = proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({
                    text: content.text || content.body || ''
                }),
                footer: content.footer
                    ? proto.Message.InteractiveMessage.Footer.create({ text: content.footer })
                    : undefined,
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                    buttons: (content.buttons || []).map((b) =>
                        proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create(b)
                    )
                })
            });
            
            const message = proto.Message.create({ interactiveMessage });
            encoded = encodeNewsletterMessage(message);
            resultMessage = message;
        } else {
            // Any other message type
            encoded = encodeNewsletterMessage(content);
            resultMessage = content;
        }
        
        await _sendNewsletterNode(jid, encoded, msgId, options.additionalAttributes || {});
        
        return { 
            key: { remoteJid: jid, fromMe: true, id: msgId }, 
            message: resultMessage 
        };
    };

    // Direct send for relayMessage
    const newsletterSendDirect = async (jid, message, options = {}) => {
        const { encodeNewsletterMessage } = await import('../Utils/index.js');
        const msgId = options.messageId || generateMessageTag();
        
        const encoded = encodeNewsletterMessage(message);
        await _sendNewsletterNode(jid, encoded, msgId, options.additionalAttributes || {});
        
        return true;
    };

    return {
        ...sock,
        
        // Main unified send function
        newsletterSend,
        newsletterSendDirect,

        newsletterCreate: async (name, description) => {
            const variables = {
                input: { name, description: description ?? null }
            };
            const rawResponse = await executeWMexQuery(
                variables,
                QueryIds.CREATE,
                XWAPaths.xwa2_newsletter_create
            );
            return parseNewsletterCreateResponse(rawResponse);
        },

        newsletterUpdate,

        newsletterSubscribers: async (jid) => {
            return executeWMexQuery(
                { newsletter_id: jid },
                QueryIds.SUBSCRIBERS,
                XWAPaths.xwa2_newsletter_subscribers
            );
        },

        newsletterMetadata: async (type, key) => {
            const variables = {
                fetch_creation_time: true,
                fetch_full_image: true,
                fetch_viewer_metadata: true,
                input: { key, type: type.toUpperCase() }
            };
            const result = await executeWMexQuery(
                variables,
                QueryIds.METADATA,
                XWAPaths.xwa2_newsletter_metadata
            );
            return parseNewsletterMetadata(result);
        },

        newsletterFollow: (jid) => {
            return executeWMexQuery(
                { newsletter_id: jid },
                QueryIds.FOLLOW,
                XWAPaths.xwa2_newsletter_join_v2
            );
        },

        newsletterUnfollow: (jid) => {
            return executeWMexQuery(
                { newsletter_id: jid },
                QueryIds.UNFOLLOW,
                XWAPaths.xwa2_newsletter_leave_v2
            );
        },

        newsletterMute: (jid) => {
            return executeWMexQuery(
                { newsletter_id: jid },
                QueryIds.MUTE,
                XWAPaths.xwa2_newsletter_mute_v2
            );
        },

        newsletterUnmute: (jid) => {
            return executeWMexQuery(
                { newsletter_id: jid },
                QueryIds.UNMUTE,
                XWAPaths.xwa2_newsletter_unmute_v2
            );
        },

        newsletterUpdateName: async (jid, name) => {
            return newsletterUpdate(jid, { name });
        },

        newsletterUpdateDescription: async (jid, description) => {
            return newsletterUpdate(jid, { description });
        },

        newsletterUpdatePicture: async (jid, content) => {
            const { img } = await generateProfilePicture(content);
            return newsletterUpdate(jid, { picture: img.toString('base64') });
        },

        newsletterRemovePicture: async (jid) => {
            return newsletterUpdate(jid, { picture: '' });
        },

        newsletterReactMessage: async (jid, serverId, reaction) => {
            await query({
                tag: 'message',
                attrs: {
                    to: jid,
                    ...(reaction ? {} : { edit: '7' }),
                    type: 'reaction',
                    server_id: serverId,
                    id: generateMessageTag()
                },
                content: [
                    {
                        tag: 'reaction',
                        attrs: reaction ? { code: reaction } : {}
                    }
                ]
            });
        },

        newsletterFetchMessages: async (jid, count, since, after) => {
            const messageUpdateAttrs = { count: count.toString() };
            if (typeof since === 'number') messageUpdateAttrs.since = since.toString();
            if (after) messageUpdateAttrs.after = after.toString();

            return query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'get',
                    xmlns: 'newsletter',
                    to: jid
                },
                content: [{ tag: 'message_updates', attrs: messageUpdateAttrs }]
            });
        },

        subscribeNewsletterUpdates: async (jid) => {
            const result = await query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'set',
                    xmlns: 'newsletter',
                    to: jid
                },
                content: [{ tag: 'live_updates', attrs: {}, content: [] }]
            });
            const liveUpdatesNode = getBinaryNodeChild(result, 'live_updates');
            const duration = liveUpdatesNode?.attrs?.duration;
            return duration ? { duration } : null;
        },

        newsletterAdminCount: async (jid) => {
            const response = await executeWMexQuery(
                { newsletter_id: jid },
                QueryIds.ADMIN_COUNT,
                XWAPaths.xwa2_newsletter_admin_count
            );
            return response.admin_count;
        },

        newsletterChangeOwner: async (jid, newOwnerJid) => {
            await executeWMexQuery(
                { newsletter_id: jid, user_id: newOwnerJid },
                QueryIds.CHANGE_OWNER,
                XWAPaths.xwa2_newsletter_change_owner
            );
        },

        newsletterDemote: async (jid, userJid) => {
            await executeWMexQuery(
                { newsletter_id: jid, user_id: userJid },
                QueryIds.DEMOTE,
                XWAPaths.xwa2_newsletter_demote
            );
        },

        newsletterDelete: async (jid) => {
            await executeWMexQuery(
                { newsletter_id: jid },
                QueryIds.DELETE,
                XWAPaths.xwa2_newsletter_delete_v2
            );
        },

        // Keep original for backward compatibility
        newsletterSendMedia: async (jid, content, waUploadToServer, options = {}) => {
            const { encodeNewsletterMessage, generateMessageIDV2, prepareWAMessageMedia } =
                await import('../Utils/index.js');

            const msgId = options.messageId || generateMessageIDV2(sock.user?.id);

            const mediaMsg = await prepareWAMessageMedia(content, {
                upload: waUploadToServer,
                logger: config.logger,
                mediaCache: config.mediaCache,
                options: config.options,
                jid 
            });

            const encoded = encodeNewsletterMessage(mediaMsg);
            await _sendNewsletterNode(jid, encoded, msgId, options.additionalAttributes || {});

            return { key: { remoteJid: jid, fromMe: true, id: msgId }, message: mediaMsg };
        },

        newsletterSendButtons: async (jid, content, options = {}) => {
            const { encodeNewsletterMessage, generateMessageIDV2 } =
                await import('../Utils/index.js');
            const { proto } = await import('../../WAProto/index.js');

            const msgId = options.messageId || generateMessageIDV2(sock.user?.id);

            const interactiveMessage = proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({
                    text: content.body || ''
                }),
                footer: content.footer
                    ? proto.Message.InteractiveMessage.Footer.create({ text: content.footer })
                    : undefined,
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                    buttons: (content.buttons || []).map((b) =>
                        proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create(b)
                    )
                })
            });

            const message = proto.Message.create({ interactiveMessage });
            const encoded = encodeNewsletterMessage(message);

            await _sendNewsletterNode(jid, encoded, msgId, options.additionalAttributes || {});

            return { key: { remoteJid: jid, fromMe: true, id: msgId }, message };
        },

        // ... දැනට ඇති කේතයට පහළින් මෙය එක් කරන්න ...

newsletterVotePoll: async (jid, serverId, optionIndex) => {
    return await query({
        tag: 'iq', // 'message' වෙනුවට 'iq' භාවිතා කරන්න
        attrs: {
            to: jid,
            id: generateMessageTag(),
            type: 'set',
            xmlns: 'newsletter' // මෙය අනිවාර්යයෙන්ම එක් කරන්න
        },
        content: [
            {
                tag: 'poll_vote',
                attrs: {
                    poll_creation_message_key: serverId
                },
                content: [
                    {
                        tag: 'selected_options',
                        content: [
                            {
                                tag: 'option',
                                attrs: { index: optionIndex.toString() }
                            }
                        ]
                    }
                ]
            }
        ]
    });
},
        
        // Convenience methods
        newsletterSendText: async (jid, text, options = {}) => {
            return newsletterSend(jid, { text }, sock.waUploadToServer, options);
        }
    };
};
