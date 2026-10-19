CREATE TABLE "asset_use" (
	"diagram_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "asset_use_diagram_id_hash_pk" PRIMARY KEY("diagram_id","hash")
);
--> statement-breakpoint
ALTER TABLE "asset_use" ADD CONSTRAINT "asset_use_diagram_id_diagram_id_fk" FOREIGN KEY ("diagram_id") REFERENCES "public"."diagram"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_use" ADD CONSTRAINT "asset_use_owner_id_hash_asset_owner_id_hash_fk" FOREIGN KEY ("owner_id","hash") REFERENCES "public"."asset"("owner_id","hash") ON DELETE cascade ON UPDATE no action;