/* eslint-disable @typescript-eslint/no-explicit-any */
import { html } from "../../../modules/templates/engine";

export const indexTemplate = (d: any, t: any, e: any) => html`
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

  <!-- Test 11: Using Form Element -->
  <h2>Form Element Example:</h2>
  ${e.form({
    context: d,
    title: "Contact Form",
    button: "Send Message",
    action: "/contact",
    method: "post",
    fields: html`
      <input name="name" type="text" placeholder="Your Name" required />
      <input name="email" type="email" placeholder="Your Email" required />
      <textarea name="message" placeholder="Your Message" required></textarea>
    `,
  })}

  <!-- Test 12: Using Page Element Directly -->
  <h2>Page Element Example:</h2>
  ${e.page({
    title: "Sample Page",
    page: html`
      <p>This is content inside a page element!</p>
      ${t.if(true)}
      <h1>I'm here!</h1>
      ${t.end()}
      <ul>
        ${t.each(
          ["Feature 1", "Feature 2", "Feature 3"],
          (feature: string) => `<li>${feature}</li>`,
        )}
      </ul>
    `,
  })}

  <!-- Test 13: Using Head Element -->
  <h2>Head Element Example:</h2>
  <div>Raw head element output:</div>
  ${t.unsafe(e.head({ title: "Test Page Title" }).render())}

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
