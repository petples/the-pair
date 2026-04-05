export function isPairActive(
  status:
    | 'Idle'
    | 'Mentoring'
    | 'Executing'
    | 'Reviewing'
    | 'Paused'
    | 'Awaiting Human Review'
    | 'Error'
    | 'Finished'
): boolean {
  return status === 'Mentoring' || status === 'Executing' || status === 'Reviewing'
}

export function isPairBusy(
  status:
    | 'Idle'
    | 'Mentoring'
    | 'Executing'
    | 'Reviewing'
    | 'Paused'
    | 'Awaiting Human Review'
    | 'Error'
    | 'Finished'
): boolean {
  return isPairActive(status) || status === 'Awaiting Human Review'
}
