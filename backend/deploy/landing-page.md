# Landing page bootcamp

Landing page uses the existing public CMS endpoints: `/api/courses`, `/api/sensei`, and `/api/testimonials`. Only published records are returned by the server. Drafts remain hidden, coming-soon courses cannot open enrollment, and ordering follows the admin sort order. Empty sensei/testimonial lists hide their sections. A failed catalog request shows an explicit fallback without invented programs or prices.

In Admin → Kursus, maintain the title, level, tagline, features, thumbnail, featured badge, CTA label, publication status, and order as before. Two added fields:

- **Harga sudah final — tampilkan di landing page**: defaults to off for all existing and new courses (migration 141). Prices remain hidden until explicitly approved. This controls landing-page presentation, not the existing payment/access model.
- **Jadwal untuk landing page**: optional public text for the class days, times, and timezone; it never exposes protected live-class meeting/recording URLs. Empty text displays a schedule-to-be-announced message. Bootcamp frequency is two online classes per week, as confirmed by the owner.

The approved design presents one bootcamp offering with self-paced dashboard access included. Existing CMS courses appear as its class catalog. Prices are read from `price_label`, `period_label`, and `price_idr` only after the publication flag is true. Unapproved prices lead to consultation rather than course checkout. Approved, available courses link to the existing login/detail flow. Returning enrolled students are routed to their dashboard after the server confirms their access.

Sensei and testimonials use admin-published content, with no fabricated testimonials or outcomes. Rich-text fields are displayed as plain text. Photo URLs allow only HTTP(S); broken images are removed. Static imagery licenses and photographer links are in `photo-credits.html`. The learning screenshots use the existing frontend with clearly labeled example data and no real student information.

Consultation opens a real WhatsApp contact link using the same contact number as the previous landing page. Opening the dialog itself does not send a message or submit data. Registration and login use the existing authentication pages. No sandbox status labels, pricing placeholders from the old site, or rejected photos are shipped.

Run `node --test landing-cms.test.js` and `node --test backend/src/landing-course-fields.test.js`. CI additionally runs the existing backend and student contract suites. Schema migration 141 runs through the existing deployment workflow before API restart.
