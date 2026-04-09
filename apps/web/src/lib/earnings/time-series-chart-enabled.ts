/**
 * When false, the earnings “over time” chart on `/earnings` is hidden (dashboard card is numeric only).
 * Payment node `POST /payment/income` must bucket by calendar day keys (`YYYY-MM-DD`) that align
 * with the period returned to SaaS — see `masumi-payment-service` `getDayNumberLocal` (iso-short).
 */
export const EARNINGS_TIME_SERIES_CHART_ENABLED = true;
