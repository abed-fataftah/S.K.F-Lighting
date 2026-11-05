# Sign in, register, reset password
Route: `/account/sign-in` (tabs by `?tab=login|register|reset`)
Purpose: Let a customer or electrician sign in, create an account or reset the password.
Source in scope: Accounts (register, sign in, reset password; everyone registers as a regular user). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Sign in / register

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `sign-in.01` | تسجيل الدخول |
| `sign-in.02` | حساب جديد |
| `sign-in.03` | البريد الإلكتروني |
| `sign-in.04` | كلمة المرور |
| `sign-in.05` | نسيت كلمة المرور؟ |
| `sign-in.06` | دخول |
| `sign-in.07` | الاسم الكامل |
| `sign-in.08` | رقم الهاتف |
| `sign-in.09` | إنشاء الحساب |
| `sign-in.10` | أدخل بريدك الإلكتروني وسنرسل لك رابطاً لاستعادة كلمة المرور. |
| `sign-in.11` | إرسال رابط الاستعادة |
| `sign-in.12` | العودة لتسجيل الدخول |
| `sign-in.13` | تفضّل الطلب بدون حساب؟ |
| `sign-in.14` | يمكنك الطلب كضيف وتتبّعه برقم الطلب ورقم الهاتف. |
| `sign-in.15` | المتابعة كضيف |
| `sign-in.16` | تتبّع طلب |
| `sign-in.17` | نوع الدخول |
| `sign-in.18` | [الاسم] |
| `sign-in.19` | [رقم الهاتف] |
| `sign-in.20` | واتساب |
| `sign-in.21` | إنشاء حساب |
| `sign-in.22` | استعادة كلمة المرور |

## Layout
Mobile (390) (designed):
1. Header (shared). h1 24/800: "تسجيل الدخول", "إنشاء حساب" or "استعادة كلمة المرور" (padding 12 0 12).
2. Tabs (login and register only): two equal buttons 48 high.
3. Card (padding 14): fields per tab. Login: البريد الإلكتروني, كلمة المرور, link button "نسيت كلمة المرور؟", yellow large "دخول". Register: الاسم الكامل, رقم الهاتف, البريد الإلكتروني, كلمة المرور, yellow large "إنشاء الحساب". Reset: text, البريد الإلكتروني, yellow large "إرسال رابط الاستعادة", link button "العودة لتسجيل الدخول".
4. Card (margin-top 12): "تفضّل الطلب بدون حساب؟", line 13 muted, outline large "المتابعة كضيف", outline large "تتبّع طلب".
5. Footer, bottom bar (tab: حسابي), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: account) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Tabs | Tabs | two buttons | `aria-pressed` |
| Fields | Input | email, tel, password | `autocomplete` email, name, tel, current-password, new-password |
| Guest card | Card |  | "المتابعة كضيف" goes to `/cart`; "تتبّع طلب" goes to `/orders/track` |

## Data
Supabase Auth (email and password). New users get the role "customer". The owner promotes electricians in the dashboard.

## States
Wrong credentials: inline error under the form "البريد الإلكتروني أو كلمة المرور غير صحيحة." (wording is mine, O-13). Email already used, weak password, reset email sent ("أرسلنا رابط الاستعادة إلى بريدك."): not drawn; use inline message patterns. Loading on submit: button "جارٍ الدخول" disabled.

## Interactions
1. Tabs switch the form without leaving the page.
2. "نسيت كلمة المرور؟": shows the reset form.
3. "دخول": signs in; customers go to the page they came from (or `/account/orders`), electricians the same.
4. "إنشاء الحساب": creates the account, signs in.
5. "المتابعة كضيف": `/cart`. "تتبّع طلب": `/orders/track`.

## Accessibility
Form errors `role="alert"`; focus the first invalid field. Password field has no show/hide button (not designed).

## SEO
`noindex`.

## Open items
Sign-in identifier: the board uses email and password; phone login is not designed (O-14). Email confirmation step after registering: not designed. Social login: not in scope.
