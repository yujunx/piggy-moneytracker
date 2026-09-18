import { findMoney, merchantKeyword, parseReceipt, type ParseContext } from '../src/ocr/parse';

const categories: ParseContext['categories'] = [
  { id: 1, name: 'Food', type: 'expense' },
  { id: 2, name: 'Transport', type: 'expense' },
  { id: 3, name: 'Groceries', type: 'expense' },
  { id: 4, name: 'Shopping', type: 'expense' },
  { id: 5, name: 'Bills & Utilities', type: 'expense' },
  { id: 6, name: 'Petrol', type: 'expense' },
  { id: 7, name: 'Subscriptions', type: 'expense' },
  { id: 8, name: 'Other', type: 'expense' },
  { id: 20, name: 'Salary', type: 'income' },
  { id: 21, name: 'Refund', type: 'income' },
  { id: 22, name: 'Other', type: 'income' },
];

const accounts = [
  { id: 1, name: 'Cash' },
  { id: 2, name: 'Maybank Savings' },
  { id: 3, name: 'TNG eWallet' },
];

const now = new Date(2026, 8, 18, 20, 0); // 18 Sep 2026, 8pm
const ctx: ParseContext = { categories, accounts, learnedRules: [], now };

describe('findMoney', () => {
  it('reads RM amounts with and without spaces/commas', () => {
    expect(findMoney('Total RM12.50').map((t) => t.sen)).toEqual([1250]);
    expect(findMoney('RM 1,234.56').map((t) => t.sen)).toEqual([123456]);
    expect(findMoney('-RM8.90')[0]).toMatchObject({ sen: 890, sign: '-', hasCurrency: true });
  });

  it('ignores dates, percentages and zero', () => {
    expect(findMoney('18.09.2026')).toEqual([]);
    expect(findMoney('SST 6.00%')).toEqual([]);
    expect(findMoney('RM0.00')).toEqual([]);
  });
});

describe('parseReceipt', () => {
  it('TNG eWallet DuitNow QR payment', () => {
    const r = parseReceipt(
      [
        '9:41',
        'Transaction Details',
        'Payment Successful',
        '-RM12.50',
        'Paid to',
        'RESTORAN NASI KANDAR PELITA',
        'Date & Time',
        '17 Sep 2026, 1:05 PM',
        'Payment Method',
        "Touch 'n Go eWallet",
        'Wallet Balance RM45.20',
      ].join('\n'),
      ctx,
    );
    expect(r.amountSen).toBe(1250);
    expect(r.type).toBe('expense');
    expect(r.merchant).toBe('RESTORAN NASI KANDAR PELITA');
    expect(r.datetime).toBe('2026-09-17 13:05');
    expect(r.categoryId).toBe(1);
    expect(r.categoryConfidence).toBe('high');
    expect(r.accountId).toBe(3);
    expect(r.accountHint).toBe('TNG eWallet');
  });

  it('GrabFood receipt picks the total, not subtotal/fees', () => {
    const r = parseReceipt(
      [
        'GrabFood',
        'Your order from McDonald\'s - Bangsar',
        '1x Big Mac Meal RM18.90',
        '1x McFlurry RM6.50',
        'Subtotal RM25.40',
        'Delivery fee RM4.00',
        'Service fee RM0.80',
        'Total RM30.20',
        'Paid by GrabPay',
        '16/09/2026 19:42',
      ].join('\n'),
      ctx,
    );
    expect(r.amountSen).toBe(3020);
    expect(r.amountConfidence).toBe('high');
    expect(r.categoryId).toBe(1);
    expect(r.datetime).toBe('2026-09-16 19:42');
    expect(r.accountHint).toBe('GrabPay');
    expect(r.accountId).toBeNull(); // user has no Grab account
  });

  it('MAE incoming DuitNow transfer is income', () => {
    const r = parseReceipt(
      [
        'MAE',
        'You received money!',
        'RM 250.00',
        'Received from',
        'AHMAD BIN ALI',
        'Transfer Details',
        'Reference: dinner split',
        'Date 15 Sep 2026 10:15 AM',
      ].join('\n'),
      ctx,
    );
    expect(r.type).toBe('income');
    expect(r.amountSen).toBe(25000);
    expect(r.merchant).toBe('AHMAD BIN ALI');
    expect(r.categoryId).toBe(22); // income "Other"
    expect(r.accountId).toBe(2);
  });

  it('supermarket receipt: store name from top, cash/change ignored', () => {
    const r = parseReceipt(
      [
        '99 SPEED MART S/B (519537-X)',
        'NO 12 JALAN SS2/24, PETALING JAYA',
        'Tel: 03-7876 1234',
        'Date: 14/09/26  Time: 21:30',
        'MILO 1KG 29.90',
        'GARDENIA BREAD 4.20',
        'Sub Total 34.10',
        'Rounding -0.00',
        'TOTAL 34.10',
        'CASH 50.00',
        'CHANGE 15.90',
        'THANK YOU',
      ].join('\n'),
      ctx,
    );
    expect(r.amountSen).toBe(3410);
    expect(r.type).toBe('expense');
    expect(r.merchant).toBe('99 SPEED MART S/B (519537-X)');
    expect(r.categoryId).toBe(3);
    expect(r.datetime).toBe('2026-09-14 21:30');
  });

  it('bank salary credit', () => {
    const r = parseReceipt(
      'Maybank2u\nAccount Credited\nSALARY SEP 2026\nACME SDN BHD\n+RM3,500.00\n2026-09-15',
      ctx,
    );
    expect(r.type).toBe('income');
    expect(r.amountSen).toBe(350000);
    expect(r.categoryId).toBe(20);
    expect(r.datetime).toBe('2026-09-15 12:00');
  });

  it('uses a big-font amount when there are no labels', () => {
    const r = parseReceipt(
      [
        { text: 'Shell Malaysia', top: 100, height: 20 },
        { text: 'RM60.00', top: 200, height: 60 },
        { text: 'Points earned 60.00', top: 300, height: 20 },
      ],
      ctx,
    );
    expect(r.amountSen).toBe(6000);
    expect(r.categoryId).toBe(6);
  });

  it('dates without a year roll back when they would be in the future', () => {
    const r = parseReceipt('Paid to\nNetflix\nRM55.00\n25 Dec, 8:00 PM', ctx);
    expect(r.datetime).toBe('2025-12-25 20:00');
    expect(r.categoryId).toBe(7);
  });

  it('e-wallet top up is suggested as a transfer', () => {
    const r = parseReceipt("Touch 'n Go eWallet\nReload Successful\nRM100.00\nfrom Maybank\n18/09/2026 08:10", ctx);
    expect(r.type).toBe('transfer');
    expect(r.categoryId).toBeNull();
  });

  it('learned rules beat built-in rules', () => {
    const r = parseReceipt('Paid to\nShopee Mall Official\nRM89.00', {
      ...ctx,
      learnedRules: [{ keyword: merchantKeyword('Shopee Mall Official'), category_id: 5 }],
    });
    expect(r.categoryId).toBe(5);
    expect(r.categoryConfidence).toBe('high');
  });

  it('returns empty result for unreadable text', () => {
    const r = parseReceipt('', ctx);
    expect(r.amountSen).toBeNull();
    expect(r.amountConfidence).toBe('none');
    expect(r.datetime).toBeNull();
    expect(r.categoryId).toBe(8);
  });
});
