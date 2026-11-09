-- TestDZ / 005_coupon_payment_index
begin;
create index coupon_redemptions_payment_id_idx
  on public.coupon_redemptions(payment_id)
  where payment_id is not null;
commit;
