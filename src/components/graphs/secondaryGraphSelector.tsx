'use client';

export default function SecondaryGoalSelector() {
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault;

    const form = event.target;
    const secondaryGoalId = form.secondaryGoal.value;

    const target = new URL(window.location.href);
    target.searchParams.append("secondaryGoal", secondaryGoalId);

    window.location.href = target.href;
  }
  return (
    <>
      <form onSubmit={handleSubmit}>
        <label>
          Om du vill jämföra denna målbana med en annan kan du skriva in dess ID här:
          <input type="text" id="secondaryGoal" name="secondaryGoal" />
        </label>
        <button type="submit">Jämför</button>
      </form>
    </>
  )
}