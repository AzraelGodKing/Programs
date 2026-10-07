import { DurableObject } from "cloudflare:workers";
import { handleRequest } from "./router.js";
import { TableRoom } from "./room.js";

export class Table extends DurableObject {
  room() {
    return new TableRoom(this.ctx.storage);
  }

  create() {
    return this.room().create();
  }

  view(viewer) {
    return this.room().view(viewer);
  }

  update(update) {
    return this.room().update(update);
  }

  setShop(payload) {
    return this.room().setShop(payload);
  }

  tradeBuyback(payload) {
    return this.room().tradeBuyback(payload);
  }

  talk(message) {
    return this.room().talk(message);
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
