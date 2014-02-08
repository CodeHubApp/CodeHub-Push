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
