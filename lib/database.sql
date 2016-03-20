create table if not exists records (
    id serial primary key,
    token text,
    oauth text not null,
    username text not null,
    created_at timestamp not null DEFAULT current_timestamp,
    updated_at timestamp not null DEFAULT current_timestamp
);

create index idx_oauth on records (oauth);
