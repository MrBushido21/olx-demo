const messages = [
    {                                                                                                    
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',                                                              
      userId: 'user-buyer-0001-0000-000000000001',                                                       
      chatId: 'chat-0001-0000-0000-000000000001',                                                        
      content: 'Привет, ещё продаёте?',
      created_at: new Date('2024-04-20T10:00:00')
    },
    {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      userId: 'user-seller-0001-0000-000000000002',
      chatId: 'chat-0001-0000-0000-000000000001',
      content: 'Да, в наличии!',
      created_at: new Date('2024-04-20T10:01:00')
    },
    {
      id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      userId: 'user-buyer-0001-0000-000000000001',
      chatId: 'chat-0001-0000-0000-000000000001',
      content: 'Какое состояние товара?',
      created_at: new Date('2024-04-20T10:02:00')
    },
    {
      id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
      userId: 'user-seller-0001-0000-000000000002',
      chatId: 'chat-0001-0000-0000-000000000001',
      content: 'Отличное, пользовались аккуратно',
      created_at: new Date('2024-04-20T10:03:00')
    },
    {
      id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
      userId: 'user-buyer-0001-0000-000000000001',
      chatId: 'chat-0001-0000-0000-000000000001',
      content: 'Можно встретиться завтра в центре?',
      created_at: new Date('2024-04-20T10:04:00')
    },
  ]

const cutedMessages = []

messages.map(message => {
    const cutedMessage = {
      userId: message.userId,
      content: message.content,
      created_at: message.created_at
    }
    cutedMessages.push(cutedMessage)
})

console.log(cutedMessages);
