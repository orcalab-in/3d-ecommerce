-- Saved profile for logged-in customers: prefill checkout with their last
-- delivery address instead of retyping it every order.
alter table customers add column if not exists address text;
alter table customers add column if not exists pincode text;
