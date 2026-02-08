type SubscribePricingProps = {
  formAction: string;
};

export default function SubscribePricing({ formAction }: SubscribePricingProps) {

  return (
    <section aria-labelledby="pricing-heading">
      <h2
        id="pricing-heading"
        className="text-lg sm:text-xl font-semibold text-gray-900 mb-4"
      >
        Support options
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-4">
        {/* Supporter tier */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 sm:p-5 flex flex-col">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Supporter
          </h3>
          <div className="mt-4 mb-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                €1
              </span>
              <span className="text-xs text-gray-500">/ month</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Donation. No additional features promised.
          </p>
          <a
            href="https://buy.stripe.com/eVqaEX09mh1h9RC619f3a00"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            aria-label="Support Luxury Intelligence - Supporter tier"
          >
            Support
          </a>
        </div>

        {/* Backer tier */}
        <div className="relative rounded-xl border border-blue-200 bg-white shadow-sm p-4 sm:p-5 flex flex-col">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Backer
          </h3>
          <div className="mt-4 mb-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                €3
              </span>
              <span className="text-xs text-gray-500">/ month</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Donation. No additional features promised.
          </p>
          <a
            href="https://buy.stripe.com/eVqcN51dq26n4xi619f3a01"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            aria-label="Support Luxury Intelligence - Backer tier"
          >
            Support
          </a>
        </div>
      </div>

    </section>
  );
}



