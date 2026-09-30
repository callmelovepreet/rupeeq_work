# RupeeQ personal loan landing page

Static build of `project/RupeeQ PL Landing.dc.html`. No framework, no build step.

```
site/
  index.html          page markup
  css/rupeeq-pl.css   compiled Tailwind stylesheet from the design (unchanged)
  css/site.css        animations: scroll reveal, step transitions, accordions, sticky CTA, modal
  js/app.js           form flow, EMI calculator, tabs, FAQ, sticky CTA, exit modal, analytics
```

Serve the folder with any static server, for example `python3 -m http.server -d site 8080`.

## Configuration

`window.RQ_CONFIG` in `index.html`:

| Key          | Default                 | Notes                                                         |
| ------------ | ----------------------- | ------------------------------------------------------------- |
| `apiBase`    | `""`                    | Empty runs **demo mode** (mock API). Set to the API origin to go live. |
| `offersPath` | `/personal-loan/offers` | Fallback redirect after eligibility.                          |
| `links`      | `/terms`, `/privacy`    | Consent checkbox links.                                       |

In demo mode any 6-digit OTP verifies, `000000` returns a mismatch error, and step 4 shows the URL it would redirect to.

## API contract (live mode)

All calls are `POST` JSON with `credentials: "include"`. A non-2xx response should return `{ message, code }`; `message` is shown to the user.

| Endpoint              | Body                                                                                           | Response        |
| --------------------- | ---------------------------------------------------------------------------------------------- | --------------- |
| `/api/pl/otp/send`    | `name, mobile, consent_marketing, consent_ts, attribution, context{purpose, amount_hint}`       | `{ requestId }` |
| `/api/pl/otp/verify`  | `request_id, otp`                                                                              | `{ leadId, token }` |
| `/api/pl/eligibility` | `leadId, token, employment_type, monthly_income, pincode, purpose, amount_hint, attribution`   | `{ redirectUrl }` |

## Behaviour notes

- Form progress (except the OTP) is kept in `sessionStorage` (`rq_pl_form_v1`), so a reload resumes at the OTP or details step. It is cleared once offers load.
- UTM and click IDs are captured into `sessionStorage` (`rq_attr`) and sent with each API call.
- Analytics events go to `window.dataLayer` with PII keys and values stripped: `page_view`, `scroll_depth`, `form_start`, `cta_click`, `otp_request`, `otp_success`, `eligibility_complete`, `calculator_use`, `charges_expand`, `faq_open`, `exit_modal_view`.
- The exit-intent modal shows once per session: when the cursor leaves through the top of the window on desktop (after 8s), or on the first back navigation on touch devices.
- All motion respects `prefers-reduced-motion`.
