// class Action {
//   id = 1;
// }

// class Right {
//   id = 1;
// }

export default {
  trackable: {
    fields: {
      history: { type: "embed" },
    },
    embeds: {
      history: {
        type: "Action",
        fields: {
          right: { type: "embed", required: true },
          user: { type: "ref", required: true },
          timestamp: { type: "date", required: true },
        },
        references: {
          user: { ref: "users", type: "single" },
        },
        embeds: {
          right: {
            type: "Right",
            fields: {
              name: { type: "string", required: true },
            },
          },
        },
      },
    },
  },
};
