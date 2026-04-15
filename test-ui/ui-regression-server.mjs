import { createApp } from "../server.mjs";
import {
  MOVIES_ROOT,
  TORRENTS_ROOT,
  TV_ROOT,
} from "../src/core/executor.mjs";

const port = Number(process.env.UI_REGRESSION_PORT || 4173);
const host = "127.0.0.1";

const FIXTURE_ITEMS = [
  { type: "d", name: "@eaDir" },
  { type: "d", name: "A Knight of the Seven Kingdoms (Season 1) DV HDR10 WEB-DL 2160p" },
  { type: "d", name: "A.Knight.of.the.Seven.Kingdoms.S01.2160p.2026.2160p.WEB-DL.HDR.H.265.Master5" },
  { type: "d", name: "Parks.and.Recreation.S01.1080p.AMZN.WEB-DL.Rus.Eng.Subtitles.Multi.Audio.Very.Long.Release.Name" },
  { type: "f", name: "Standalone.Movie.2024.1080p.WEB-DL.H.265.mkv" },
];

function makeSavedTemplatesStore() {
  const items = [
    {
      id: "saved-long-1",
      kind: "season",
      title: "A Knight of the Seven Kingdoms Season One A Very Long Saved Title That Should Truncate On Mobile",
      year: 2026,
      season: 1,
      srcPath: "/volume1/torrents/Shows/A Knight of the Seven Kingdoms Season One A Very Long Source Folder Name",
      createdAt: "2026-04-04T00:00:00.000Z",
      updatedAt: "2026-04-04T00:00:00.000Z",
    },
  ];
  return {
    list() {
      return [...items];
    },
    upsert(input) {
      const item = {
        id: input?.id ?? "saved-1",
        kind: input?.kind ?? "movie",
        title: input?.title ?? "Fixture title",
        year: Number(input?.year ?? 2026),
        season: input?.season == null ? null : Number(input.season),
        srcPath: input?.srcPath ?? null,
        createdAt: "2026-04-04T00:00:00.000Z",
        updatedAt: "2026-04-04T00:00:00.000Z",
      };
      items.splice(0, items.length, item);
      return item;
    },
    delete() {
      items.splice(0, items.length);
      return { ok: true };
    },
  };
}

const fixtureRoots = new Set([TORRENTS_ROOT, MOVIES_ROOT, TV_ROOT]);
const fixtureSearchItems = Array.from({ length: 8 }, (_, index) => ({
  title: `Kimetsu no Yaiba result ${index + 1} with a deliberately long title`,
  year: 2024,
  type: "show",
  summary: `Fixture result ${index + 1}`,
}));

const executor = {
  async linkMovie() {
    return { code: 0, stdout: "fixture movie linked", stderr: "" };
  },
  async linkSeason() {
    return { code: 0, stdout: "fixture season linked", stderr: "" };
  },
  async listDir({ dir }) {
    if (!fixtureRoots.has(dir)) {
      return { ok: true, code: 0, items: [] };
    }
    return {
      ok: true,
      code: 0,
      items: FIXTURE_ITEMS,
    };
  },
};

const metadata = {
  ok: true,
  status: 200,
  data: {
    MediaContainer: {
      Metadata: fixtureSearchItems,
    },
  },
};

const app = createApp({
  runToken: "ui-regression-token",
  executor,
  savedTemplatesStore: makeSavedTemplatesStore(),
  appAuthUser: null,
  appAuthPasswordHash: null,
  hasPlexDiscoverConfigFn: () => true,
  plexDiscoverContainerFn: async () => metadata,
  enrichItemsWithOmdbPosterFn: async (items) => items,
});

const server = app.listen(port, host, () => {
  console.log(`UI regression fixture server listening on http://${host}:${port}`);
});

function shutdown(signal) {
  server.close((error) => {
    if (error) {
      console.error(`Failed to stop fixture server after ${signal}`, error);
      process.exitCode = 1;
    }
    process.exit();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
