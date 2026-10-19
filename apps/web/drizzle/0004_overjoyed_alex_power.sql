CREATE TABLE "asset" (
	"owner_id" text NOT NULL,
	"hash" text NOT NULL,
	"type" text NOT NULL,
	"bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_owner_id_hash_pk" PRIMARY KEY("owner_id","hash"),
	CONSTRAINT "asset_bytes_check" CHECK ("asset"."bytes" > 0 and "asset"."bytes" <= 8000000),
	CONSTRAINT "asset_hash_check" CHECK ("asset"."hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;