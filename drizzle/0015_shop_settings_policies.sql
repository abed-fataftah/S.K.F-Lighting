CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_slug_unique" UNIQUE("slug"),
	CONSTRAINT "pages_slug_check" CHECK ("pages"."slug" in ('privacy', 'terms', 'returns'))
);
--> statement-breakpoint
ALTER TABLE "pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_fee_range_check" CHECK ("delivery_zones"."fee" between 0 and 50000 and "delivery_zones"."fee" % 100 = 0);--> statement-breakpoint
-- Spec 0025 AC-14: starter drafts in Arabic Markdown, for the owner to read and correct before
-- launch (they are not legal advice). Storefront text never names cheques (handoff section 11).
insert into public.pages (slug, title, body) values
('privacy', 'سياسة الخصوصية', $body$## ما نجمعه
عند الطلب نحفظ اسمك ورقم هاتفك وعنوان التوصيل وتفاصيل طلبك. وإذا أنشأت حساباً نحفظ بريدك الإلكتروني أيضاً.

## لماذا نجمعه
نستخدم هذه البيانات لتجهيز طلبك وتوصيله ومتابعته، وللتواصل معك عبر واتساب بخصوص طلبك.

## مع من نشاركها
لا نبيع بياناتك لأي جهة. نشاركها فقط بالقدر اللازم لتوصيل طلبك.

## تعديل بياناتك أو حذفها
لتعديل بياناتك أو طلب حذفها، راسلنا على واتساب وسنساعدك.$body$),
('terms', 'الشروط والأحكام', $body$## الأسعار
الأسعار بالشيكل وقد تتغير. السعر المعتمد هو السعر الظاهر لحظة إرسال الطلب.

## تأكيد الطلب
يُعتبر طلبك مؤكداً عندما يتواصل معك المتجر.

## الدفع
تدفع عند التوصيل أو عند الاستلام من المعرض، نقداً أو بطريقة يتفق عليها المتجر معك.

## التوصيل
تعتمد رسوم التوصيل على منطقتك، وتظهر لك في صفحة إتمام الطلب قبل الإرسال.

## إلغاء الطلب
يمكنك إلغاء طلبك قبل توصيله من صفحة الطلب.$body$),
('returns', 'سياسة الإرجاع', $body$## مدة الإرجاع
يمكنك طلب الإرجاع خلال 7 أيام من تاريخ التوصيل.

## شروط الإرجاع
يجب أن يكون المنتج غير مستخدم وفي علبته الأصلية.

## كيف تطلب الإرجاع
أرسل لنا رقم طلبك على واتساب، مع اسم المنتج الذي تريد إرجاعه.

## بعد الفحص
يفحص المتجر المنتج، ثم يتفق معك على استرداد المبلغ أو استبدال المنتج.$body$);
