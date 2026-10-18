/**
 * Full-frame overlay on the camera during the calibration countdown, then a
 * short "Baseline set!" confirmation. Renders nothing otherwise.
 */
export default function CalibrationOverlay({ countdown }) {
  const { secondsLeft, isCountingDown, justCalibrated } = countdown
  if (!isCountingDown && !justCalibrated) return null

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 px-6 text-center backdrop-blur-[2px]">
      {/* Faint center line as a "line up your spine" guide. */}
      <div className="absolute inset-y-8 left-1/2 w-0.5 -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-300/30 to-transparent" />

      {isCountingDown ? (
        <>
          <div
            key={secondsLeft}
            className="countdown-pop relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-cyan-300 bg-slate-900 shadow-[0_0_40px_rgba(34,211,238,0.45)]"
          >
            <span className="text-5xl font-bold text-white">{secondsLeft}</span>
          </div>
          <h3 className="relative mt-5 text-2xl font-bold text-white">Sit Up Straight…</h3>
          <p className="relative mt-2 max-w-sm text-cyan-100/80">
            Relax your neck and align your shoulders. Setting your custom baseline in {secondsLeft}s.
          </p>
        </>
      ) : (
        <>
          <div className="countdown-pop relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-teal-300 bg-teal-400/20 shadow-[0_0_40px_rgba(45,212,191,0.5)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 text-teal-200" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </div>
          <h3 className="relative mt-5 text-2xl font-bold text-white">Baseline Set!</h3>
          <p className="relative mt-2 max-w-sm text-cyan-100/80">This is now your good posture.</p>
        </>
      )}
    </div>
  )
}
