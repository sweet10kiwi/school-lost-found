create table public.school_lost_found_posts (
 id uuid primary key,
 type text not null check (type in ('lost','found')),
 color text not null check (color in ('black','white','gray','red','orange','yellow','green','blue','navy','purple','pink','brown','other')),
 "itemType" text not null check ("itemType" in ('earphones','headphones','phone','tablet','laptop','charger','power-bank','usb-drive','wallet','card','key','bag','pencil-case','stationery','book','clothing','shoes','umbrella','bottle','glasses','watch','accessory','other')),
 location text not null check (location in ('classroom-grade1','classroom-grade2','classroom-grade3','corridor-floor1','corridor-floor2','corridor-floor3','corridor-floor4','stairs','entrance','shoe-lockers','library','study-room','computer-room','science-lab','music-room','art-room','technology-room','gym','playground','cafeteria','cafeteria-entrance','school-store','restroom','water-station','nurse-room','teachers-office','admin-office','auditorium','school-gate','bike-rack','other')),
 "locationDetail" text not null default '' check (length("locationDetail") <= 100),
 date date not null check (date <= (now() at time zone 'Asia/Seoul')::date),
 features text not null check (length(btrim(features)) between 1 and 500),
 "storageLocation" text not null default '' check (length("storageLocation") <= 100),
 status text not null default 'open' check (status in ('open','returned')),
 owner_hash text not null check (owner_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 check (type <> 'found' or length(btrim("storageLocation")) > 0),
 check (location not in ('classroom-grade1','classroom-grade2','classroom-grade3','stairs','restroom','water-station','shoe-lockers','other') or length(btrim("locationDetail")) > 0)
);
alter table public.school_lost_found_posts enable row level security;
revoke all on public.school_lost_found_posts from public, anon, authenticated;
grant select,insert,update on public.school_lost_found_posts to service_role;
create index school_lost_found_recent on public.school_lost_found_posts (created_at desc,id desc);
create index school_lost_found_owner_recent on public.school_lost_found_posts (owner_hash,created_at desc);
comment on table public.school_lost_found_posts is 'School lost-and-found public posts; access only via validated Edge API. owner_hash never returned to clients.';
