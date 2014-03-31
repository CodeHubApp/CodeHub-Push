CREATE DATABASE IF NOT EXISTS codehub_push;

USE codehub_push;

CREATE TABLE IF NOT EXISTS records (
    id int(11) NOT NULL AUTO_INCREMENT,
    token varchar(128) NOT NULL,
    oauth varchar(64) NOT NULL,
    domain varchar(128) NOT NULL,
    username varchar(64) NOT NULL,
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp,
    PRIMARY KEY (id)
);

ALTER TABLE records ADD INDEX (oauth);

CREATE TABLE IF NOT EXISTS update_cycles (
    id int(11) NOT NULL AUTO_INCREMENT,
    row_id int(11) NOT NULL UNIQUE KEY,
    started_at timestamp NOT NULL,
    ended_at timestamp NOT NULL,
    tasks smallint unsigned NOT NULL,
    PRIMARY KEY (id)
);

ALTER TABLE update_cycles ADD INDEX (started_at);
ALTER TABLE update_cycles ADD INDEX (ended_at);
