-- ============================================================
-- DateSpot — Seed User 2: Evan Lin
-- Google Product Engineer · South Lake Union · Seattle
-- ============================================================
--
-- BEFORE YOU PASTE THIS:
--
--   1. Go to Supabase → Authentication → Users
--      https://supabase.com/dashboard/project/qlqcuuxhzdozjfboxeud/auth/users
--
--   2. Click "Add user → Create new user":
--        Email:             evan@datespot.app
--        Password:          (anything strong, you won't use it)
--        Auto confirm user: ✅
--
--   3. Copy the UID shown in the users list.
--
--   4. Find-and-replace  6f12ed43-e7a6-46b1-a9ed-7dc5421219ed  with that UID in this
--      file, then paste the whole thing into the SQL Editor.
--
-- ============================================================


insert into public.visits (
  id, user_id, venue_name, lat, lng,
  visited_at, rating, rank_order, notes,
  activity_type, price, triage, is_seed, created_at
) values

  -- ── FOOD ─────────────────────────────────────────────────

  (
    'seed2_001', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Kamonegi', 47.6509, -122.3498,
    '2000-01-01T00:00:00Z', 9.1, 0.91,
    'Handmade soba in a tiny Fremont room. Order the tsuke soba and whatever seasonal tempura they''re running. Counter seating means you''re close enough to actually talk. Reservation required — book two weeks out.',
    'food', 3, 'great', true, now()
  ),

  (
    'seed2_002', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Maneki', 47.5982, -122.3253,
    '2000-01-01T00:00:00Z', 8.8, 0.88,
    'Seattle''s oldest Japanese restaurant. Red lacquered booths, sake list that rewards attention, and food that doesn''t try to impress you. The gyoza and black cod are the move. Cash-only still, which somehow adds to it.',
    'food', 2, 'great', true, now()
  ),

  (
    'seed2_003', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Spinasse', 47.6139, -122.3207,
    '2000-01-01T00:00:00Z', 8.5, 0.85,
    'Handmade Piedmontese pasta on Capitol Hill. Tajarin with butter and sage is embarrassingly simple and exactly right. The room is small and warm. Good for a second date when you want to signal that you actually know food.',
    'food', 3, 'great', true, now()
  ),

  (
    'seed2_004', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Revel', 47.6499, -122.3437,
    '2000-01-01T00:00:00Z', 8.4, 0.84,
    'Korean-influenced Northwest cooking in Fremont. Open kitchen, communal tables, loud in the best way. The rice bowls and dumplings are reliable, the cocktails are decent. Good energy for a casual second date.',
    'food', 2, 'great', true, now()
  ),

  (
    'seed2_005', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'How to Cook a Wolf', 47.6371, -122.3568,
    '2000-01-01T00:00:00Z', 8.3, 0.83,
    'Mario Batali-adjacent Italian on Queen Anne that outlasted the controversy. The cured meats board is the right opener. Pasta is excellent. Small room, dim light, actually romantic without being corny about it.',
    'food', 3, 'great', true, now()
  ),

  (
    'seed2_006', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Un Bien', 47.6517, -122.3411,
    '2000-01-01T00:00:00Z', 8.0, 0.80,
    'Puerto Rican roast chicken sandwiches in Fremont. Counter order, paper-lined baskets, absurdly good. Perfect for a low-stakes weekend lunch date before walking Gas Works. Cash-only and worth it.',
    'food', 1, 'great', true, now()
  ),

  (
    'seed2_007', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Din Tai Fung', 47.6620, -122.3027,
    '2000-01-01T00:00:00Z', 6.2, 0.62,
    'Reliable XLB at University Village. Long waits, efficient execution, consistent every time. Works well for a casual date where you both just want good dumplings without drama. The shrimp fried rice is underrated.',
    'food', 2, 'okay', true, now()
  ),

  (
    'seed2_008', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Plum Bistro', 47.6128, -122.3189,
    '2000-01-01T00:00:00Z', 5.8, 0.58,
    'Upscale vegan on Capitol Hill. The mac and yease is genuinely good; a few dishes overreach. Worth knowing about if you''re going out with someone plant-based. Service is warm and the space has good energy.',
    'food', 2, 'okay', true, now()
  ),

  -- ── DRINKS ───────────────────────────────────────────────

  (
    'seed2_009', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Canon', 47.6163, -122.3189,
    '2000-01-01T00:00:00Z', 9.0, 0.90,
    'The serious cocktail bar on Capitol Hill. 4,000+ spirits, bartenders who know what they''re doing, no attitude about it. Order off-menu by describing what you want. Best for a third or fourth date when you want to go somewhere that rewards curiosity.',
    'bars', 3, 'great', true, now()
  ),

  (
    'seed2_010', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Navy Strength', 47.6126, -122.3481,
    '2000-01-01T00:00:00Z', 8.7, 0.87,
    'Tiki bar in Belltown done with actual craft. The drinks are strong, the room feels like a secret, and the snacks hit. Go for the Last Resort and the crispy chicken. Loud enough that a slow conversation isn''t awkward.',
    'bars', 2, 'great', true, now()
  ),

  (
    'seed2_011', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Barnacle', 47.6685, -122.3838,
    '2000-01-01T00:00:00Z', 8.5, 0.85,
    'Tiny natural wine and oyster bar in Ballard attached to Staple & Fancy. Standing room only, usually. The list skews orange and funky — bring someone who''s either into it or genuinely curious. Excellent for pre-dinner drinks.',
    'bars', 3, 'great', true, now()
  ),

  (
    'seed2_012', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Rumba', 47.6137, -122.3258,
    '2000-01-01T00:00:00Z', 8.2, 0.82,
    'Rum-focused bar on Pike with a serious daiquiri program and good small plates. Lower key than Canon, easier to get into. The Hemingway daiquiri is the benchmark. Works well as a stop between dinner and wherever else.',
    'bars', 2, 'great', true, now()
  ),

  (
    'seed2_013', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Knee High Stocking Co.', 47.6183, -122.3188,
    '2000-01-01T00:00:00Z', 6.5, 0.65,
    'Low-key Capitol Hill cocktail spot that skips the theater. Competent drinks, no wait, better than the neighborhood''s dive bars. Good option when you want cocktails without the Canon commitment or price.',
    'bars', 2, 'okay', true, now()
  ),

  -- ── COFFEE (categorized as other) ────────────────────────

  (
    'seed2_014', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Elm Coffee Roasters', 47.6016, -122.3302,
    '2000-01-01T00:00:00Z', 8.6, 0.86,
    'Single-origin pour-over in Pioneer Square. The space is sparse and precise, which feels intentional. Best espresso in the city by a narrow margin. Good for a first-date coffee if you both care about what''s in the cup.',
    'other', 1, 'great', true, now()
  ),

  (
    'seed2_015', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Victrola Coffee Roasters', 47.6143, -122.3249,
    '2000-01-01T00:00:00Z', 8.1, 0.81,
    'Capitol Hill institution. Large windows, enough noise to make silence comfortable, reliable brewing. The Pike Pine location handles the first-date energy well — busy enough that awkward pauses don''t land. Good beans to buy on the way out.',
    'other', 1, 'great', true, now()
  ),

  (
    'seed2_016', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Cafe Fiore', 47.6369, -122.3618,
    '2000-01-01T00:00:00Z', 6.7, 0.67,
    'Quiet Queen Anne coffee shop that''s been there forever. Drip is just fine, espresso is fine. Earns its place because it''s easy parking, low pressure, and genuinely pleasant to sit in for an hour. Consistent.',
    'other', 1, 'okay', true, now()
  ),

  (
    'seed2_017', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Analog Coffee', 47.6195, -122.3222,
    '2000-01-01T00:00:00Z', 6.0, 0.60,
    'Small Capitol Hill shop with good light and decent espresso. Gets crowded on weekends. Does the job when you''re already in the neighborhood and need somewhere to land. Not destination-worthy but dependable.',
    'other', 1, 'okay', true, now()
  ),

  -- ── OUTDOORS ─────────────────────────────────────────────

  (
    'seed2_018', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Gas Works Park', 47.6454, -122.3341,
    '2000-01-01T00:00:00Z', 8.5, 0.85,
    'Industrial ruins turned park on the north shore of Lake Union. The hill gives you the full skyline shot. Good for post-dinner walks, weekend afternoons, or that moment where you run out of things to say and just watch boats for a while.',
    'outdoors', 0, 'great', true, now()
  ),

  (
    'seed2_019', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Lake Union Park', 47.6282, -122.3363,
    '2000-01-01T00:00:00Z', 8.0, 0.80,
    'Flat, walkable, right in SLU. You can watch seaplanes take off. The fountain area is good for a low-stakes first walk — close to tons of restaurants and bars for before or after. Underused by people who live five minutes away.',
    'outdoors', 0, 'great', true, now()
  ),

  (
    'seed2_020', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Volunteer Park', 47.6374, -122.3155,
    '2000-01-01T00:00:00Z', 8.3, 0.83,
    'Capitol Hill''s crown. The water tower climb gives you a 360 view of the city. The conservatory is free and underrated. Wander for an hour, then walk down the hill to Capitol Hill proper for food. A solid mid-afternoon date structure.',
    'outdoors', 0, 'great', true, now()
  ),

  (
    'seed2_021', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Alki Beach', 47.5784, -122.4073,
    '2000-01-01T00:00:00Z', 7.8, 0.78,
    'West Seattle waterfront with a straight-on view of downtown across the Sound. Best at golden hour. The drive over the bridge is part of the experience. A little far from SLU but worth it once if you''ve never done a sunset walk here.',
    'outdoors', 0, 'great', true, now()
  ),

  -- ── VIEW ─────────────────────────────────────────────────

  (
    'seed2_022', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Kerry Park', 47.6295, -122.3598,
    '2000-01-01T00:00:00Z', 9.2, 0.92,
    'The Seattle skyline shot. Mt. Rainier behind the Space Needle on a clear day. Tiny park on Queen Anne Hill — go at dusk, bring a jacket. It''s on every tourist list for a reason. Still works because the view actually earns it.',
    'view', 0, 'great', true, now()
  ),

  -- ── ENTERTAINMENT ────────────────────────────────────────

  (
    'seed2_023', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Frye Art Museum', 47.6064, -122.3288,
    '2000-01-01T00:00:00Z', 8.0, 0.80,
    'Free admission, always. On First Hill, which is easy from Capitol Hill or downtown. The permanent collection is mostly 19th-century European but well-curated. Rotating shows are hit or miss but give you something to react to. Good for a first date that isn''t just coffee.',
    'entertainment', 0, 'great', true, now()
  ),

  (
    'seed2_024', '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed',
    'Seattle Pinball Museum', 47.5981, -122.3268,
    '2000-01-01T00:00:00Z', 7.5, 0.75,
    'One cover charge, all machines on free play. International District, easy parking. Works surprisingly well as a low-pressure date: you''re doing something, there''s natural competitive energy, and it''s loud enough that you don''t have to perform conversation. Better in the evening.',
    'entertainment', 1, 'great', true, now()
  );


-- ── Verify the insert ───────────────────────────────────────

select id, venue_name, activity_type, price, rating, triage
from public.visits
where user_id = '6f12ed43-e7a6-46b1-a9ed-7dc5421219ed'
  and is_seed = true
order by activity_type, rating desc;
