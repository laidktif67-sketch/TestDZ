# TestDZ — Mockup Reference

This branch is reserved exclusively for TestDZ UI mockups and their documentation. It is not an application-code branch. Keep implementation changes on the project branch / pull request.

## Organization
Each screen has its own folder under `mockups/`. Original PNG assets are preserved unchanged; this commit only moves files and updates documentation.

## Rewards
- [REWARDS-01 — Tester Rewards & Achievements](mockups/REWARDS-01_Tester-Rewards-Achievements/REWARDS-01_Tester-Rewards-Achievements.png)
- [REWARDS-02 — Reward Details](mockups/REWARDS-02_Reward-Details/REWARDS-02_Reward-Details.png)

## Wallet and withdrawals
- [WALLET-01 — Wallet Points & Transactions](mockups/WALLET-01_Wallet-Points-Transactions/WALLET-01_Wallet-Points-Transactions.png)
- [WALLET-02 — Withdrawal Request](mockups/WALLET-02_Withdrawal-Request/WALLET-02_Withdrawal-Request.png)
- [WALLET-03 — Withdrawal Details & Status](mockups/WALLET-03_Withdrawal-Details-Status/WALLET-03_Withdrawal-Details-Status.png)
- [WALLET-04 — Wallet & Rewards](mockups/WALLET-04_Wallet-and-Rewards/WALLET-04_Wallet-and-Rewards.png)
- [WALLET-05 — Withdrawal Rejected / Failed](mockups/WALLET-05_Withdrawal-Rejected-Failed/WALLET-05_Withdrawal-Rejected-Failed.png)
- [WALLET-06 — Withdrawal Success](mockups/WALLET-06_Withdrawal-Success/WALLET-06_Withdrawal-Success.png)

## Design-to-app audit notes
- Screen IDs are reference identifiers, not a requirement for one route per image.
- WALLET-01 and WALLET-04 need a content-overlap review before treating them as separate pages.
- WALLET-05 and WALLET-06 are withdrawal outcome states; keep them in the same workflow unless implementation requirements prove otherwise.
