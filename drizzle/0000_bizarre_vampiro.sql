CREATE TYPE "public"."payment_status" AS ENUM('active', 'canceled', 'past_due', 'incomplete', 'unpaid', 'trialing');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('none', 'free', 'supporter_monthly', 'patron_monthly');--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"plan_type" "plan_type" DEFAULT 'none' NOT NULL,
	"email_digest_enabled" boolean DEFAULT false NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"payment_status" "payment_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "subscribers_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "subscribers_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
