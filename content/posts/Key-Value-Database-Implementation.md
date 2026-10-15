---

draft: false
title: Implement a KVDB Key-Value Database effectively using Interfaces
date: 2021-02-15T23:57:07.239Z
lastmod: 2021-02-15T23:57:09.579Z
author: Punit Naran
cover: /img/database-1954920_640.jpg
images: null
weight: 1
categories:
  - Database
tags:
  - Database
  - Interface
  - Redis
---

# Simple (KVDB) Key-Value Database Implementation

For this post I will be showing you how to implement a Database interface. This will be a simple Key-Value Database.

- The database should have at least a minimum interface for a KVDB
  - Get, Set and Delete operations
  - Close Database connection

First lets create a `database.go` file. We can call it a `database` package.

Now we need to implement a Database instance. The code below shows the minimum required calls (operations) needed for a Key-Value Database.

```go

// DBStore is a database instance
type DBStore interface {
  
  // Get returns a value for a given key, or a error response.
  Get(key string) ([]byte, error)

  // Set will store the value in the assosiated key block, or create a key
  // block and store the value. If there is an invalid error of data it should 
  // return a bad request error.
  Set(key string, value []byte) error

  // Delete will delete the value for a given key.
  Delete(key string) error

  // Close will close the database, expect no error if the database has been
  // disconnected, otherwise an error response.
  Close() error

}

// NotFoundError indicates that no value was found for the given key
type NotFoundError struct {
	missingKey string
}

// NewNotFoundError returns a new error for the missing key
func NewNotFoundError(missingKey string) error {
	return &NotFoundError{missingKey}
}

// Error returns missing key error string
func (n *NotFoundError) Error() string {
	return fmt.Sprintf("Could not find value for key: %s", n.missingKey)
}

```

Now we can select our Key-Value Database. From this interface implementation we could also link an in-memory store database, however for this post we will just focus on using redis. 

Assuming that you have created a go file, given the file a package name like `redis` and imported the `go-redis` repository.

We can now do the following: 

```go
import (
  ...
  // path to your database.go file
  "github.com/punitnaran/example/database"
)

// RedisDatabase wraps the redis client so we can now expose it to
// our application
type RedisDatabase struct {
  Client *redis.Client

  // If you have created a connection or are using a different version of redis 
  // you may want to use the Do command which sends a command to the 
  // server and returns the received reply. Have a look at this as an example:
  // https://pkg.go.dev/github.com/garyburd/redigo/redis#hdr-Executing_Commands
}

var (
  // ErrNil Redis no match response
  ErrNil = errors.New("no matching record found in redis database")

  // Ctx an empty context to use with the client
  Ctx    = context.TODO()
)

// NewRedisDatabase connects the client to the redis server
// returning an redis client instance
func NewRedisDatabase(address string) (*Database, error) {
  // Client connects to redis server with provided options
  client := redis.NewClient(&redis.Options{
      Addr: address,
      Password: "",
      DB: 0,
  })

  // Ping to the connection to check if it is alive
  if err := client.Ping(Ctx).Err(); err != nil {
      return nil, err
  }

  // Return the redis client instance
  return &RedisDatabase{
    Client: client,
  }, nil
}

// Get returns the value from the specifed key otherwise a NotFoundError if the
// key has not been found, or any other error encountered
func (db *RedisDatabase) Get(key string) ([]byte, error) {
  value, err := client.Get(key).Result()
  if err == redis.Nil {
    // Key not found
    return nil, database.NewNotFoundError(key)
  }
  if err != nil {
    // Encountered another error
    return nil, err
  }
  return value, nil
}

// Sut adds value to the database and returns any error encountered
func (db *RedisDatabase) Set(key string, value []byte) error {
  err = client.Set(key, value, 0).Err()
  if err != nil {
    return err
  }
  return nil
}

// Deletes the key and value pair
func (db *RedisDatabase) Delete(key string) error{
   return client.Del(key).Err()
}

// Close closes the client and any open resources
func (db *RedisDatabase) Close() error{
  return db.Close()
}
```

### Referances
> Niklas
> -- <cite>[Implementing a key-value database in Golang]</cite>
> 
> Michael Okoko
> -- <cite>[How to use Redis as a database with go-redis]</cite>


[Implementing a key-value database in Golang]:https://blog.olif.nu/post/kvdb-1/
[How to use Redis as a database with go-redis]: https://blog.logrocket.com/how-to-use-redis-as-a-database-with-go-redis/