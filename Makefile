
# When hyperdht is not installed globally, use
# npx to run on-the-fly with local download
ifneq ("$(wildcard /usr/local/bin/hyperdht)","")
	HYPERDHT = hyperdht
else
	HYPERDHT = "npx hyperdht"
endif

HOST=127.0.0.1
PORT=50153

bootstrap:
	@echo "Now bootstraping DHT network at ${HOST}:${PORT}"
	${HYPERDHT} --bootstrap --host ${HOST} --port ${PORT}
