export const CATEGORY_FIELDS = {
    clothes: [    
      { name: 'condition', type: 'enum', values: ['new', 'used'], required: true },
      { name: 'size', type: 'string', required: false },
      { name: 'color', type: 'string', required: false },
      { name: 'brand', type: 'string', required: false },
      { name: 'material', type: 'string', required: false },
      { name: 'print', type: 'enum', values: ['yes', 'no'], required: false },
      { name: 'contract_type', type: 'enum', values: ['sell', 'exchange', 'free'], required: true },
      { name: 'price', type: 'number', required: true },
    ],

    //{"condition": "new", "contract_type": "sell", "price": "1000"} 

    phones: [
        {name: 'brand', type:'string', required: true},
        { name: 'condition', type: 'enum', values: ['new', 'used'], required: true },
        { name: 'diagonal', type: 'string', required: true },
        { name: 'price', type: 'string', required: true },
    ],
}
