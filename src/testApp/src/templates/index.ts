/* eslint-disable @typescript-eslint/no-explicit-any */
import { html } from "../../../modules/templates/engine";

export default (d: any, t: any, e: any) => html`
  <h1>Template Engine Test Examples</h1>

  <!-- Test 1: If tag with true condition -->
  <h2>If Tag (true):</h2>
  ONE ${t.if(true)} TWO ${t.end()} THREE

  <!-- Test 2: If tag with false condition -->
  <h2>If Tag (false):</h2>
  BEFORE ${t.if(false)} HIDDEN ${t.end()} AFTER

  <!-- Test 3: Each tag with array -->
  <h2>Each Tag:</h2>
  <ul>
    ${t.each(
      ["apple", "banana", "cherry"],
      (item: string) => `<li>${item}</li>`,
    )}
  </ul>

  <!-- Test 4: Each tag with numbers -->
  <h2>Each with Numbers:</h2>
  Numbers: ${t.each([1, 2, 3, 4, 5], (num: number) => `[${num}] `)}

  <!-- Test 5: Unsafe tag (raw HTML) -->
  <h2>Unsafe Tag:</h2>
  ${t.unsafe("<strong>This is <em>raw HTML</em> content!</strong>")}

  <!-- Test 6: Nested conditions -->
  <h2>Nested If Tags:</h2>
  ${t.if(true)} Outer condition is true! ${t.if(false)} Inner hidden ${t.end()}
  ${t.if(true)} Inner visible! ${t.end()} ${t.end()}

  <!-- Test 7: Each with objects -->
  <h2>Each with Objects:</h2>
  ${t.each(
    [
      { name: "John", age: 30 },
      { name: "Jane", age: 25 },
    ],
    (person: any) => `<p>${person.name} is ${person.age} years old</p>`,
  )}

  <!-- Test 8: Using elements parameter -->
  <h2>Elements Test:</h2>
  <p>Elements parameter type: ${typeof e}</p>

  <!-- Test 9: Nested Each inside If -->
  <h2>Nested Each in If:</h2>
  ${t.if(true)}
  <p>Showing fruits because condition is true:</p>
  <ul>
    ${t.each(
      ["apple", "banana", "cherry"],
      (fruit: string) => `<li>🍎 ${fruit}</li>`,
    )}
  </ul>
  ${t.end()} ${t.if(false)}
  <p>This list won't show because condition is false:</p>
  <ul>
    ${t.each(["hidden1", "hidden2"], (item: string) => `<li>${item}</li>`)}
  </ul>
  ${t.end()}

  <!-- Test 10: Multiple nested structures -->
  <h2>Complex Nesting:</h2>
  ${t.if(true)}
  <div>
    <h3>User List:</h3>
    ${t.each(
      [
        { name: "Alice", active: true },
        { name: "Bob", active: false },
        { name: "Charlie", active: true },
      ],
      (user: any) =>
        user.active
          ? `<p>✅ ${user.name} is active</p>`
          : `<p>❌ ${user.name} is inactive</p>`,
    )}
  </div>
  ${t.end()}
`;
