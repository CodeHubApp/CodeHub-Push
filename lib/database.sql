CREATE TABLE IF NOT EXISTS records (
    id serial primary key,
    token varchar(128) NOT NULL,
    oauth varchar(64) NOT NULL,
    username varchar(64) NOT NULL,
    created_at timestamp with time zone default (now() at time zone 'utc'),
    updated_at timestamp with time zone default (now() at time zone 'utc'),
    UNIQUE (token, username)
);

CREATE INDEX oauth_idx ON records (oauth);
