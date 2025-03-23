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
        <label className='font-weight-500'>
          Jämför målbana
          <div className="focusable flex margin-top-25" style={{borderRadius: '2px', backgroundColor: 'var(--gray-90)'}}>
            <input type="text" id="secondaryGoal" name="secondaryGoal" className="transparent" style={{fontSize: '.75rem', borderRadius: '2px', padding: '.3rem .6rem'}} />
            <button type="submit" className="font-weight-500 transparent" style={{fontSize: '.75rem', borderRadius: '2px', padding: '.3rem .6rem'}} >Jämför</button>
          </div>
        </label>
      </form>
    </>
  )
}