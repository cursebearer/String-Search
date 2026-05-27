/**
 * Interface base do padrao Strategy.
 * Cada algoritmo concreto estende essa classe e implementa search() e getSteps().
 */
export class SearchStrategy {
  getKey() {
    throw new Error('getKey() nao implementado em ' + this.constructor.name);
  }

  getName() {
    throw new Error('getName() nao implementado em ' + this.constructor.name);
  }

  getComplexity() {
    throw new Error('getComplexity() nao implementado em ' + this.constructor.name);
  }

  search(text, pattern) {
    throw new Error('search() nao implementado em ' + this.constructor.name);
  }

  getSteps(text, pattern) {
    throw new Error('getSteps() nao implementado em ' + this.constructor.name);
  }
}
