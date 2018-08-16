const PENDING = 'pending'
const RESOLVED = 'resolved'
const REJECTED = 'rejected'

class Promize {
  get isResolved() {
    return this.status === RESOLVED
  }

  get isRejected() {
    return this.status === REJECTED
  }

  get isPending() {
    return this.status === PENDING
  }

  constructor(fn) {
    this.status = PENDING
    this.value = undefined
    this.onResolvedFns = []
    this.onRejectedFns = []

    try {
      fn(this.resolve.bind(this), this.reject.bind(this))
    } catch (err) {
      this.reject(err)
    }
  }

  resolve(value) {
    if (this.isPending) {
      this.status = RESOLVED
      this.value = value

      nextTick(() => {
        this.onResolvedFns.forEach((fn) => {
          fn(this.value)
        })
      })
    }
  }

  reject(reason) {
    if (this.isPending) {
      this.status = REJECTED
      this.value = reason

      nextTick(() => {
        this.onRejectedFns.forEach((fn) => {
          fn(this.value)
        })
      })
    }
  }

  then(onResolved = identity, onRejected = identity) {
    if (!isFunctionType(onResolved)) onResolved = identity
    if (!isFunctionType(onRejected)) onRejected = identity

    let nextPromise = null

    switch (this.status) {
      case PENDING:
        nextPromise = new Promize((resolve, reject) => {
          this.onResolvedFns.push(() => {
            try {
              const x = onResolved(this.value)
              resolvePromise(nextPromise, x, resolve, reject)
            } catch (err) {
              reject(err)
            }
          })

          this.onRejectedFns.push(() => {
            try {
              const x = onRejected(this.value)
              resolvePromise(nextPromise, x, resolve, reject)
            } catch (err) {
              reject(err)
            }
          })
        })
        break
      case RESOLVED:
        nextPromise = new Promize((resolve, reject) => {
          nextTick(() => {
            try {
              const x = onResolved(this.value)
              resolvePromise(nextPromise, x, resolve, reject)
            } catch (err) {
              reject(err)
            }
          })
        })
      case REJECTED:
        nextPromise = new Promize((resolve, reject) => {
          nextTick(() => {
            try {
              const x = onRejected(this.value)
              resolvePromise(nextPromise, x, resolve, reject)
            } catch (err) {
              reject(err)
            }
          })
        })
        break
      default:
        console.error('unknown promise status');
        break
    }

    return nextPromise
  }

  catch(onRejected = identity) {
    return this.then(null, onRejected)
  }

  finally(fn = identity) {
    return this.then(() => nextTick(() => fn()), () => nextTick(() => fn()))
  }
}

Promize.resolve = function (value) {
  return new Promize((resolve, reject) => {
    nextTick(() => {
      resolve(value)
    })
  })
}

Promize.reject = function (reason) {
  return new Promize((resolve, reject) => {
    nextTick(() => {
      reject(reason)
    })
  })
}

Promize.all = function (promises) {
  let count = 0
  const results = []

  return new Promize((resolve, reject) => {

    for (let i = 0; i < promises.length; i++) {
      promises[i]
        .then(data => {
          count += 1
          results[i] = data

          if (count === promises.length) {
            resolve(results)
          }
        })
        .catch(err => {
          reject(err)
        })
    }
  })
}

Promize.race = function () {
  return new Promize((resolve, reject) => {

    for (let i = 0; i < promises.length; i++) {
      promises[i]
        .then(data => {
          resolve(results)
        })
        .catch(err => {
          reject(err)
        })
    }
  })
}

// util methods
function isObjectType(obj) {
  return typeof obj === 'object'
}

function isFunctionType(obj) {
  return typeof obj === 'function'
}

function isPromiseLike(obj) {
  return obj instanceof Promize || obj instanceof Promise || (!!obj && isFunctionType(obj.then))
}

function noop() { }

function identity(e) { return e }

function nextTick(fn) {
  return setTimeout(fn, 0)
}

// Promise A+ Promise Resolution Procedure
function resolvePromise(nextPromise, x, resolve, reject) {
  var then
  var thenCalledOrThrow = false

  if (nextPromise === x) {
    return reject(new TypeError('Chaining cycle detected for promise!'))
  }

  if (x instanceof Promise) {
    if (x.status === 'pending') {
      x.then(function (value) {
        resolvePromise(nextPromise, value, resolve, reject)
      }, reject)
    } else {
      x.then(resolve, reject)
    }
    return
  }

  if ((x !== null) && (isObjectType(x) || isFunctionType(x))) {
    try {

      then = x.then
      if (typeof then === 'function') {
        then.call(
          x,
          function rs(y) {
            if (thenCalledOrThrow) return
            thenCalledOrThrow = true
            return resolvePromise(nextPromise, y, resolve, reject)
          },
          function rj(r) {
            if (thenCalledOrThrow) return
            thenCalledOrThrow = true
            return reject(r)
          }
        )
      } else {
        resolve(x)
      }
    } catch (e) {
      if (thenCalledOrThrow) return
      thenCalledOrThrow = true
      return reject(e)
    }
  } else {
    resolve(x)
  }
}

// for unit-test purpose
Promize.deferred = function () {
  var dfd = {}
  dfd.promise = new Promize(function (resolve, reject) {
    dfd.resolve = resolve
    dfd.reject = reject
  })
  return dfd
}

module.exports = Promize