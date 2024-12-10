'use client';

export default function SecondaryGoalSelector() {
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.target;
    const secondaryGoalId = form.secondaryGoal.value;

    const target = new URL(window.location.href);
    target.searchParams.append("secondaryGoal", secondaryGoalId);

    window.location.href = target.href;
  }
  return (
    <>
      <form onSubmit={handleSubmit} className="flex-grow-100">
        <div className="focusable flex smooth gray-90">
          <input type="text" id="secondaryGoal" name="secondaryGoal" className="transparent" />
          <button type="submit" className="font-weight-500" style={{ fontSize: '1rem', borderRadius: '0 0 3px 3px' }}>Jämför</button>
        </div>
      </form>
    </>
  )
}