package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	rawURI := "mongodb+srv://irfanmohamed1182005_db_user:Irfan1123@polling.e6halcl.mongodb.net/?retryWrites=true&w=majority"
	log.Printf("Testing connection to MongoDB Atlas URI: %s...", rawURI)

	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	tlsConfig := &tls.Config{
		InsecureSkipVerify: true,
	}

	clientOpts := options.Client().
		ApplyURI(rawURI).
		SetTLSConfig(tlsConfig)

	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		log.Fatalf("MongoDB Connect Error: %v", err)
	}
	defer client.Disconnect(context.Background())

	err = client.Ping(ctx, nil)
	if err != nil {
		log.Printf("MongoDB Ping Failed: %v", err)
		log.Println("Note: If Ping timed out or failed with TLS error, please ensure your IP address is whitelisted in MongoDB Atlas under Network Access -> Add IP Address -> Allow Access from Anywhere (0.0.0.0/0).")
		return
	}

	fmt.Println("🎉 SUCCESS! Connected to MongoDB Atlas Cloud Cluster!")

	databases, err := client.ListDatabaseNames(ctx, nil)
	if err != nil {
		log.Printf("List Database Error: %v", err)
	} else {
		fmt.Printf("Databases in Atlas Cluster: %v\n", databases)
	}
}
