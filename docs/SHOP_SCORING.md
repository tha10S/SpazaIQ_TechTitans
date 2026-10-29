# How a shop's score is worked out

Every shop gets a score out of 100 and a tier: **High** (70 or more), **Mid** (40 to 69) or **Low** (under 40).
The score is measured against **fixed benchmarks for a strong spaza**, never against other shops. So:

- a shop's score does not change because another shop joined or left;
- the shop's own Insights screen and the admin screen always show the same number;
- the code lives in `services/admin/performance.js` and the totals it reads come from `services/admin/shopStats.js`.

## What is measured

Twelve parts in three groups. Weights are in points out of 100.

| Group | Part | Points | Full marks when |
|---|---|---|---|
| **Sales and trading (62)** | Revenue | 17 | 30-day revenue reaches the benchmark (R80,000) |
| | Profit | 14 | profit reaches 20% of that benchmark |
| | Items sold | 6 | 3,500 items sold in 30 days |
| | Days trading | 9 | a sale was recorded on 24 of the last 30 days |
| | Steady week to week | 8 | every recent week had sales, with weekly totals within about 15% of each other |
| | Growth | 8 | revenue is up 50% on the earlier period. Flat scores 0.6 and a 75% fall scores 0 |
| **Stock (20)** | Products in stock | 9 | nothing is out or running low. Gaps on products that really sell count more than gaps on slow ones |
| | Stock level vs sales | 5 | the stock on the shelf covers 7 to 30 days of sales. Too little means lost sales, too much means cash tied up |
| | Expiry risk | 6 | no stock is expired or about to expire (expired counts in full, expiring within 7 days counts half) |
| **Credit (18)** | Credit paid on time | 8 | customers pay by the due date (credit that fell due in the last 90 days) |
| | Overdue credit | 6 | none of the money owed is overdue, and what is overdue is small next to a month of sales |
| | Reliance on credit | 4 | credit is under 15% of sales. At 60% it scores zero |

## Parts that do not apply are left out

A shop that never gives credit has no credit parts. A shop that is two weeks old has no growth. A shop that does not
enter expiry dates has no expiry part. These are **left out and the other weights are scaled back up to 100**. They are
never counted as zero and never as full marks.

## Fairness for new and small shops

- A shop with under 30 days of history is judged against a proportionally smaller target.
- A shop with under 14 days of history is marked "building" and cannot be High yet.
- Growth needs 50 days of history, or four complete weeks (then the last two weeks are compared with the two before).
- Stock level needs at least a week of sales. The paid-on-time part is nudged towards an average when there are only a few
  credits, so one late customer cannot swing it from 100 to 0.

## Rules that always apply

- A shop with **no sales in 30 days is always Low**.
- To be **High**, a shop must also have 14+ days of history, trade on at least half the days, sell in at least three
  recent weeks and reach 60% of the revenue benchmark. Otherwise it is held at Mid, with the score held at 69.
- Stock parts only count for a shop that is actually trading. Full shelves with no sales earn nothing.

## How "paid on time" is worked out

Each credit has a due date. It counts as paid on time when the payments made **on or before** that date add up to what
was owed. The part uses the share of credits paid in time and the share of money paid in time, averaged. Credit that is
settled but has no payment record is left out rather than guessed. This is worked out on the shop's phone from its
repayment history, and only four totals are published.

## What the admin can see

Only totals, in `shopStats/{storeId}`: revenue, profit, counts, stock value, expiry value, credit totals and four
paid-on-time totals. No customer name, phone number, individual sale or product list ever leaves the shop. The rules in
`firestore.rules` accept only the fields on that list, so a new total must be added there as well as in
`shopStatsPublisher.js`.

## Numbers that are judgement calls

These are in `BENCHMARK` at the top of `performance.js`. Adjust them as real shops come in.

- the revenue benchmark (R80,000). For a demo with small test shops, lower it, for example to 3,000;
- items sold (3,500), healthy stock cover (7 to 30 days), the expiry risk limit (15%) and the credit limits;
- the twelve weights. They add up to 100.

## Tests

`node --test __tests__/shopScore.test.mjs` checks the statistics, the paid-on-time calculation, the tiers on six example
shops, that every problem lowers the score, and that every total the app publishes is accepted by the rules.
