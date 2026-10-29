CREATE TABLE IF NOT EXISTS "access_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"mobile_number" text,
	"name" text,
	"surname" text,
	"has_admin_access" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "access_codes_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "control_diagrams" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_type" text NOT NULL,
	"gearbox" text,
	"label" text NOT NULL,
	"image_url" text,
	"is_inferred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "control_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"control_id" integer NOT NULL,
	"question_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learner_profiles" (
	"mobile_number" text PRIMARY KEY NOT NULL,
	"name" text,
	"surname" text,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learner_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"mobile_number" text NOT NULL,
	"item_type" text NOT NULL,
	"item_id" integer NOT NULL,
	"status" text NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"incorrect" integer DEFAULT 0 NOT NULL,
	"last_rating" text,
	"last_seen_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "learner_progress_unique_item" UNIQUE("mobile_number","item_type","item_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learner_test_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"mobile_number" text NOT NULL,
	"run_id" text NOT NULL,
	"finished_at" timestamp NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "learner_test_runs_unique_run" UNIQUE("mobile_number","run_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_number" integer NOT NULL,
	"question_text" text NOT NULL,
	"category" integer NOT NULL,
	"license_code" text NOT NULL,
	"contains_image" boolean NOT NULL,
	"image_link" text,
	"options" jsonb NOT NULL,
	"source_id" integer,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'System' NOT NULL,
	"is_reviewed" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rule_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"question_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sign_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sign_id" integer NOT NULL,
	"question_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "sources_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "study_controls" (
	"id" serial PRIMARY KEY NOT NULL,
	"diagram_id" integer NOT NULL,
	"component_number" integer,
	"component_name" text NOT NULL,
	"function_notes" text,
	"applicable_codes" jsonb NOT NULL,
	"is_verified_exam_question" boolean DEFAULT false NOT NULL,
	"is_reviewed" boolean DEFAULT false NOT NULL,
	"position_x" real,
	"position_y" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "study_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_ref" text NOT NULL,
	"heading" text NOT NULL,
	"subheading" text NOT NULL,
	"title" text,
	"question" text,
	"body" text NOT NULL,
	"body_raw" text,
	"applicable_codes" jsonb NOT NULL,
	"is_verified_exam_question" boolean DEFAULT false NOT NULL,
	"is_reviewed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "study_signs" (
	"id" serial PRIMARY KEY NOT NULL,
	"heading" text NOT NULL,
	"subheading" text NOT NULL,
	"name" text NOT NULL,
	"codes" jsonb NOT NULL,
	"images" jsonb DEFAULT '[]' NOT NULL,
	"where_text" text,
	"purpose_text" text,
	"action_text" text,
	"where_text_raw" text,
	"purpose_text_raw" text,
	"action_text_raw" text,
	"short_meaning" text,
	"short_action" text,
	"short_reviewed" boolean DEFAULT false NOT NULL,
	"needs_split" boolean DEFAULT false NOT NULL,
	"is_verified_exam_question" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suspended_mobiles" (
	"mobile_number" text PRIMARY KEY NOT NULL,
	"reason" text,
	"suspended_by" text,
	"suspended_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "control_questions" ADD CONSTRAINT "control_questions_control_id_study_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."study_controls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "control_questions" ADD CONSTRAINT "control_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions" ADD CONSTRAINT "questions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rule_questions" ADD CONSTRAINT "rule_questions_rule_id_study_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."study_rules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rule_questions" ADD CONSTRAINT "rule_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sign_questions" ADD CONSTRAINT "sign_questions_sign_id_study_signs_id_fk" FOREIGN KEY ("sign_id") REFERENCES "public"."study_signs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sign_questions" ADD CONSTRAINT "sign_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "study_controls" ADD CONSTRAINT "study_controls_diagram_id_control_diagrams_id_fk" FOREIGN KEY ("diagram_id") REFERENCES "public"."control_diagrams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learner_test_runs_mobile_finished_idx" ON "learner_test_runs" USING btree ("mobile_number","finished_at" DESC NULLS LAST);