// OWNER: PAY. Real wire captures from the C1 settlement, tx 0x3646125c…4eda9 on Base Sepolia.
// Pinned deliberately: `npm run poc:x402` overwrites Docs/x402-notes.md with each new run, and
// tests must not drift with it. Replace these only from a capture of a real settlement.

export const CAPTURED_REQUIRED =
  "eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cDovL2xvY2FsaG9zdDozMDAxL2FwaS9ndy9wb2Mtc2VsbGVyIiwiZGVzY3JpcHRpb24iOiJQQVkgQzEgc3Bpa2Ug4oCUIHRocm93YXdheSBwYWlkIGVuZHBvaW50IiwibWltZVR5cGUiOiIifSwiYWNjZXB0cyI6W3sic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiZWlwMTU1Ojg0NTMyIiwiYW1vdW50IjoiMTAwMDAiLCJhc3NldCI6IjB4MDM2Q2JENTM4NDJjNTQyNjYzNGU3OTI5NTQxZUMyMzE4ZjNkQ0Y3ZSIsInBheVRvIjoiMHgyZGU3QjkzODhDMjQ5RDIwODAwYkEwOTdlRDVERWI2NmU0NDM3RGM0IiwibWF4VGltZW91dFNlY29uZHMiOjMwMCwiZXh0cmEiOnsibmFtZSI6IlVTREMiLCJ2ZXJzaW9uIjoiMiJ9fV19";

export const CAPTURED_SIGNATURE =
  "eyJ4NDAyVmVyc2lvbiI6MiwicGF5bG9hZCI6eyJhdXRob3JpemF0aW9uIjp7ImZyb20iOiIweDBEM0NhQzVmMjc3MDVDNGM3MjE4NUI4Qjc0QTU0M0YzNTMwRjg0ZWYiLCJ0byI6IjB4MmRlN0I5Mzg4QzI0OUQyMDgwMGJBMDk3ZUQ1REViNjZlNDQzN0RjNCIsInZhbHVlIjoiMTAwMDAiLCJ2YWxpZEFmdGVyIjoiMCIsInZhbGlkQmVmb3JlIjoiMTc4NjczNDg3OSIsIm5vbmNlIjoiMHg1ZTU1ZGM5NWZmYjk4YzNjNzhkYzllZjk4ZWMxMTY4YTNiZmU0YmFlYjg2ZDIyYjMxMzZmMjNhYzc1OWE5OWZlIn0sInNpZ25hdHVyZSI6IjB4MTIzZjJmNTU1ZjFhNmIwNTM2MzdlMzY1Mzg3ODc2M2E1ZjYwMTI3ZDA3NTNmMTcyYmRlYjllY2RiYjA2ZTM1YjVkZWQ5N2MzNzliZWJmMjM2NWIxNWNlMTJjMGQ0OTQ3Zjg3N2FkZGFlN2U1MjkwODk5M2E2YWZiODVkMjk1MDAxYyJ9LCJyZXNvdXJjZSI6eyJ1cmwiOiJodHRwOi8vbG9jYWxob3N0OjMwMDEvYXBpL2d3L3BvYy1zZWxsZXIiLCJkZXNjcmlwdGlvbiI6IlBBWSBDMSBzcGlrZSDigJQgdGhyb3dhd2F5IHBhaWQgZW5kcG9pbnQiLCJtaW1lVHlwZSI6IiJ9LCJhY2NlcHRlZCI6eyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJlaXAxNTU6ODQ1MzIiLCJhbW91bnQiOiIxMDAwMCIsImFzc2V0IjoiMHgwMzZDYkQ1Mzg0MmM1NDI2NjM0ZTc5Mjk1NDFlQzIzMThmM2RDRjdlIiwicGF5VG8iOiIweDJkZTdCOTM4OEMyNDlEMjA4MDBiQTA5N2VENURFYjY2ZTQ0MzdEYzQiLCJtYXhUaW1lb3V0U2Vjb25kcyI6MzAwLCJleHRyYSI6eyJuYW1lIjoiVVNEQyIsInZlcnNpb24iOiIyIn19fQ==";

export const CAPTURED_RESPONSE =
  "eyJzdWNjZXNzIjp0cnVlLCJwYXllciI6IjB4MEQzQ2FDNWYyNzcwNUM0YzcyMTg1QjhCNzRBNTQzRjM1MzBGODRlZiIsInRyYW5zYWN0aW9uIjoiMHgzNjQ2MTI1YzAyNzc1ODU0OTJhYmEwMTM5YzA4YzQzYjRmNjg0OTM2MmQ5M2U0MjQ0Mzk3NzY4ZDU3YTRlZGE5IiwibmV0d29yayI6ImVpcDE1NTo4NDUzMiJ9";

export const SETTLED_TX_HASH = "0x3646125c0277585492aba0139c08c43b4f6849362d93e4244397768d57a4eda9";


// ---------------------------------------------------------------------------------------------
// Algorand TestNet (phase A0). Captured 18 August 2026 from the hosted x402 seller
// https://x402.goplausible.xyz/examples/weather — the reference implementation of an AVM seller.
// ---------------------------------------------------------------------------------------------

/**
 * The envelope exactly as it arrived: three rails in one accepts array, and the eip155 and
 * solana entries carry NO payTo. Kept because a real seller really does this, and our decoder
 * has to have an opinion about it — see the test that asserts we reject it.
 */
export const AVM_CAPTURED_REQUIRED_MULTIRAIL =
  "eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cHM6Ly94NDAyLmdvcGxhdXNpYmxlLnh5ei9leGFtcGxlcy93ZWF0aGVyIiwiZGVzY3JpcHRpb24iOiJBY2Nlc3MgdG8gcHJvdGVjdGVkIHdlYXRoZXIgQVBJIiwibWltZVR5cGUiOiIifSwiYWNjZXB0cyI6W3sic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiYWxnb3JhbmQ6U0dPMUdLU3p5RTdJRVBJdFR4Q0J5dzl4OEZtbnJDRGV4aTkvY09VSk9pST0iLCJhbW91bnQiOiIxMDAwMCIsImFzc2V0IjoiMTA0NTg5NDEiLCJwYXlUbyI6IlpNRksyT0k3WkJEMlUyN0lTRVJaQzRTNkxLTTZXTUZKUFpRNE1ZTkpEWjJWTkJOTUJBNjdSQTIyQUEiLCJtYXhUaW1lb3V0U2Vjb25kcyI6MzAwLCJleHRyYSI6eyJuYW1lIjoiVVNEQyIsImRlY2ltYWxzIjo2LCJmZWVQYXllciI6IlpNRksyT0k3WkJEMlUyN0lTRVJaQzRTNkxLTTZXTUZKUFpRNE1ZTkpEWjJWTkJOTUJBNjdSQTIyQUEifX0seyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJlaXAxNTU6ODQ1MzIiLCJhbW91bnQiOiIxMDAwMCIsImFzc2V0IjoiMHgwMzZDYkQ1Mzg0MmM1NDI2NjM0ZTc5Mjk1NDFlQzIzMThmM2RDRjdlIiwibWF4VGltZW91dFNlY29uZHMiOjMwMCwiZXh0cmEiOnsibmFtZSI6IlVTREMiLCJ2ZXJzaW9uIjoiMiJ9fSx7InNjaGVtZSI6ImV4YWN0IiwibmV0d29yayI6InNvbGFuYTpFdFdUUkFCWmFZcTZpTWZlWUtvdVJ1MTY2VlUyeHFhMSIsImFtb3VudCI6IjEwMDAwIiwiYXNzZXQiOiI0ek1NQzlzcnQ1Umk1WDE0R0FnWGhhSGlpM0duUEFFRVJZUEpnWkpEbmNEVSIsIm1heFRpbWVvdXRTZWNvbmRzIjozMDAsImV4dHJhIjp7ImZlZVBheWVyIjoiOGE4ZkZOZmsyQUdTN3JnVnYxQm9xUFVXbnpRdW9DclNoSlY4dFNFNlJBWWkifX1dfQ==";

/**
 * The same capture narrowed to its Algorand entry, field for field. This is the shape
 * narrowToOffer() hands the signer, and the shape our own sellers will emit from phase A3.
 */
export const AVM_CAPTURED_REQUIRED =
  "eyJ4NDAyVmVyc2lvbiI6MiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cHM6Ly94NDAyLmdvcGxhdXNpYmxlLnh5ei9leGFtcGxlcy93ZWF0aGVyIiwiZGVzY3JpcHRpb24iOiJBY2Nlc3MgdG8gcHJvdGVjdGVkIHdlYXRoZXIgQVBJIiwibWltZVR5cGUiOiIifSwiYWNjZXB0cyI6W3sic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiYWxnb3JhbmQ6U0dPMUdLU3p5RTdJRVBJdFR4Q0J5dzl4OEZtbnJDRGV4aTkvY09VSk9pST0iLCJhbW91bnQiOiIxMDAwMCIsImFzc2V0IjoiMTA0NTg5NDEiLCJwYXlUbyI6IlpNRksyT0k3WkJEMlUyN0lTRVJaQzRTNkxLTTZXTUZKUFpRNE1ZTkpEWjJWTkJOTUJBNjdSQTIyQUEiLCJtYXhUaW1lb3V0U2Vjb25kcyI6MzAwLCJleHRyYSI6eyJuYW1lIjoiVVNEQyIsImRlY2ltYWxzIjo2LCJmZWVQYXllciI6IlpNRksyT0k3WkJEMlUyN0lTRVJaQzRTNkxLTTZXTUZKUFpRNE1ZTkpEWjJWTkJOTUJBNjdSQTIyQUEifX1dfQ==";

/**
 * The PAYMENT-RESPONSE header exactly as the facilitator sent it, captured by `npm run poc:x402`
 * on 18 August 2026 through our own adapter. Confirmed on chain at round 66430324: 0.01 USDC
 * (ASA 10458941) to the seller, in an atomic group, with the facilitator paying the fee.
 */
export const AVM_CAPTURED_RESPONSE =
  "eyJzdWNjZXNzIjp0cnVlLCJ0cmFuc2FjdGlvbiI6IkFGS0dUUEFVWlE1U1k3VFFDSEw1TDQzNlI3TFgySVlQUkc2N0Y2VFFOUDdURTdIUVg0RFEiLCJuZXR3b3JrIjoiYWxnb3JhbmQ6U0dPMUdLU3p5RTdJRVBJdFR4Q0J5dzl4OEZtbnJDRGV4aTkvY09VSk9pST0iLCJwYXllciI6IlhOM1BNNlAyUFJXVEFHSFhFWFoyNUQ3UzJWWEtLR0dVTDRCTE1TQUhOTzRESkVDMzNPQ0FYVEVPV00ifQ==";

export const AVM_SETTLED_TX_ID = "AFKGTPAUZQ5SY7TQCHL5L436R7LX2IYPRG67F6TQNP7TE7HQX4DQ";
export const AVM_PAY_TO = "ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA";
export const AVM_NETWORK = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";

/** Base64-encodes an invented object, for the negative paths only. */
export const asHeader = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64");
