CREATE TABLE IF NOT EXISTS records (
    id integer PRIMARY KEY AUTOINCREMENT,
    token varchar(128) NOT NULL,
    oauth varchar(64) NOT NULL,
    username varchar(64) NOT NULL,
    created_at INTEGER(4) NOT NULL DEFAULT (cast(strftime('%s','now') as int)),
    updated_at INTEGER(4) NOT NULL DEFAULT (cast(strftime('%s','now') as int))
);

ALTER TABLE records ADD INDEX (oauth);
