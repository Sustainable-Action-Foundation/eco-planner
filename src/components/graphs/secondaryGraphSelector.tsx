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
        <div className="focusable flex" style={{border: '1px solid var(--gray-90)', borderRadius: '2px'}}>
          <input type="text" id="secondaryGoal" name="secondaryGoal" className="transparent" style={{fontSize: '.75rem', borderRadius: '2px', padding: '.3rem .6rem'}} />
          <button type="submit" className="font-weight-500" style={{fontSize: '.75rem', borderRadius: '2px', padding: '.3rem .6rem'}} >Jämför</button>
        </div>
      </form>
    </>
  )
}