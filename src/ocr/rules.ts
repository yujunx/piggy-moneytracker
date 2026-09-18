/**
 * Built-in keyword rules for Malaysian merchants, e-wallets and banks.
 * Category names must match the seeded categories in db/client.ts.
 * Order matters: more specific rules come first (e.g. "ShopeeFood" before "Shopee").
 */

export interface CategoryRule {
  category: string;
  re: RegExp;
}

export const EXPENSE_RULES: CategoryRule[] = [
  { category: 'Food', re: /grab\s*food|food\s*panda|shopee\s*food|mcdonald|\bmcd\b|\bkfc\b|starbucks|zus\s*coffee|tealive|chagee|mixue|domino|pizza\s*hut|subway|marry\s*brown|secret\s*recipe|\bnasi\b|mamak|restoran|restaurant|kopitiam|\bcafe\b|coffee|bakery|burger|texas\s*chicken|\ba\s*&\s*w\b|sushi|boat\s*noodle|oldtown|kenny\s*rogers|llaollao|kedai\s*makan|bistro|dim\s*sum|food\s*court|\bfood\b/i },
  { category: 'Groceries', re: /grab\s*mart|lotus['’]?s|tesco|mydin|99\s*speed\s*mart|speedmart|jaya\s*grocer|village\s*grocer|aeon\s*big|\bgiant\b|econsave|\bnsk\b|hero\s*market|cold\s*storage|mercato|grocer|pasar|supermarket|hypermarket|7\s*-?\s*eleven|family\s*mart|kk\s*(super\s*)?mart/i },
  { category: 'Petrol', re: /petronas|\bshell\b|petron|caltex|\bbhpetrol\b|\bbhp\b|\bfuel\b|petrol|ron\s*9[57]|diesel|setel/i },
  { category: 'Transport', re: /grab\s*(car|ride|taxi|bike|express)|air\s*asia\s*ride|indrive|\bmaxim\b|rapid\s*kl|\bmrt\b|\blrt\b|\bktm\b|\bets\b|\btoll\b|plus\s*highway|parking|smart\s*tag|\bbus\b|\btaxi\b|\btrain\b|flight|airasia|malaysia\s*airlines|firefly|batik\s*air|pick\s*-?\s*up|drop\s*-?\s*off|\btrip\b/i },
  { category: 'Bills & Utilities', re: /\btnb\b|tenaga|air\s*selangor|syabas|indah\s*water|unifi|time\s*internet|maxis|celcom|\bdigi\b|u\s*mobile|yes\s*4g|hotlink|postpaid|prepaid|reload\s*pin|astro|\bbill\b|utilit|electric|water\s*bill|insurance|takaful/i },
  { category: 'Subscriptions', re: /netflix|spotify|youtube\s*premium|disney|hotstar|apple\.com|icloud|google\s*(one|play)|chatgpt|openai|anthropic|claude\.ai|\bviu\b|iqiyi|prime\s*video|subscription/i },
  { category: 'Shopping', re: /shopee|lazada|tiktok\s*shop|zalora|uniqlo|\bh\s*&\s*m\b|\bzara\b|mr\.?\s*diy|daiso|ikea|watsons|guardian|decathlon|padini|sephora|\bmall\b/i },
  { category: 'Health', re: /clinic|klinik|hospital|pharmacy|farmasi|caring|alpro|dental|doctor|medic/i },
  { category: 'Entertainment', re: /\bgsc\b|\btgv\b|\bmbo\b|cinema|movie|steam|playstation|nintendo|karaoke|bowling|concert|ticket/i },
  { category: 'Education', re: /universit|college|kolej|school|sekolah|tuition|course|udemy|coursera|bookstore|popular\s*book|\bmph\b|kinokuniya/i },
  { category: 'Rent', re: /\brent\b|sewa|rental|landlord/i },
];

export const INCOME_RULES: CategoryRule[] = [
  { category: 'Salary', re: /salary|gaji|payroll|pay\s*slip/i },
  { category: 'Refund', re: /refund|reversal/i },
  { category: 'Bonus', re: /cash\s*back|bonus|reward|rebate/i },
  { category: 'Allowance', re: /allowance|elaun|pocket\s*money/i },
];

export interface AccountHint {
  label: string;
  re: RegExp;
  /** Lowercase substrings used to find the user's matching account by name. */
  keys: string[];
}

export const ACCOUNT_HINTS: AccountHint[] = [
  { label: 'TNG eWallet', re: /touch\s*['’]?\s*n\s*['’]?\s*go|\btng\b/i, keys: ['tng', 'touch'] },
  { label: 'GrabPay', re: /grab\s*pay/i, keys: ['grab'] },
  { label: 'ShopeePay', re: /shopee\s*pay/i, keys: ['shopee'] },
  { label: 'Boost', re: /\bboost\b/i, keys: ['boost'] },
  { label: 'BigPay', re: /big\s*pay/i, keys: ['bigpay', 'big pay'] },
  { label: 'Maybank', re: /maybank|\bmae\b/i, keys: ['maybank', 'mae'] },
  { label: 'CIMB', re: /\bcimb\b|\bocto\b/i, keys: ['cimb'] },
  { label: 'Public Bank', re: /public\s*bank|\bpbe\b/i, keys: ['public', 'pbb'] },
  { label: 'RHB', re: /\brhb\b/i, keys: ['rhb'] },
  { label: 'Hong Leong', re: /hong\s*leong|\bhlb\b/i, keys: ['hong leong', 'hlb'] },
  { label: 'AmBank', re: /ambank/i, keys: ['ambank'] },
  { label: 'Bank Islam', re: /bank\s*islam/i, keys: ['islam'] },
  { label: 'BSN', re: /\bbsn\b/i, keys: ['bsn'] },
  { label: 'GXBank', re: /gx\s*bank/i, keys: ['gx'] },
];
