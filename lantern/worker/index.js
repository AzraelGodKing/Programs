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

  join(token, payload) {
    return this.room().join(token, payload);
  }

  view(token) {
    return this.room().view(token);
  }

  update(token, update) {
    return this.room().update(token, update);
  }

  setShop(token, payload) {
    return this.room().setShop(token, payload);
  }

  tradeBuyback(token, payload) {
    return this.room().tradeBuyback(token, payload);
  }

  talk(token, payload) {
    return this.room().talk(token, payload);
  }

  setOrder(token, order) {
    return this.room().setOrder(token, order);
  }

  setVitals(token, payload) {
    return this.room().setVitals(token, payload);
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
