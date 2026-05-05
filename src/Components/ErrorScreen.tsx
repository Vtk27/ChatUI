
type ErrorScreenProps = {
  errorMessage: string
  dismissError: () => void
}
function ErrorScreen({errorMessage, dismissError}: ErrorScreenProps) {
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
              <div className="relative w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl ring-1 ring-black/5">
                <div className="absolute right-4 top-4">
                  <button
                    type="button"
                    onClick={dismissError}
                    aria-label="Close error"
                    className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    <span className="text-base leading-none">×</span>
                  </button>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-200">
                    <span className="text-2xl leading-none">×</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-rose-500">Error</h3>
                  <p className="mt-2 text-sm text-slate-500">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={dismissError}
                    className="mt-5 rounded-full bg-rose-500 px-6 py-2 text-sm font-semibold text-white shadow-md shadow-rose-200 transition hover:bg-rose-400"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
}
export default ErrorScreen