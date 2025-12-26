/**
 * Order preview component
 */

import type { Case } from '@/types';

interface OrderPreviewProps {
  caseData: Case;
}

export function OrderPreview({ caseData }: OrderPreviewProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-teams-dark-surface">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Order Preview
      </h3>

      {/* Customer Info */}
      <div className="mb-6">
        <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Customer
        </h4>
        <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-800">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {caseData.customer.resolved.zohoDisplayName || (
              <span className="italic text-gray-400">Not resolved</span>
            )}
          </p>
          {caseData.customer.raw.value && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Raw: {caseData.customer.raw.value}
            </p>
          )}
          {caseData.customer.resolved.match && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Match: {caseData.customer.resolved.match} (
              {(caseData.customer.resolved.confidence * 100).toFixed(0)}% confidence)
            </p>
          )}
        </div>
      </div>

      {/* Order Lines */}
      <div>
        <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Line Items ({caseData.lines.length})
        </h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  #
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  SKU
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Description
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                  Qty
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                  Zoho Rate
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {caseData.lines.map((line) => (
                <tr key={line.lineNo}>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                    {line.lineNo}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                    {line.sku.value || (
                      <span className="italic text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                    <div className="max-w-xs truncate">
                      {line.description.value || (
                        <span className="italic text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-gray-900 dark:text-white">
                    {line.quantity.value !== null ? line.quantity.value : '-'}
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-gray-900 dark:text-white">
                    {line.resolved.zohoRateUsed > 0
                      ? line.resolved.zohoRateUsed.toFixed(2)
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-medium text-gray-900 dark:text-white">
                    {line.quantity.value !== null && line.resolved.zohoRateUsed > 0
                      ? (line.quantity.value * line.resolved.zohoRateUsed).toFixed(2)
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            {caseData.totalsSpreadsheet.total.value !== null && (
              <tfoot className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Spreadsheet Total:
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-gray-900 dark:text-white">
                    {caseData.totalsSpreadsheet.total.value.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
