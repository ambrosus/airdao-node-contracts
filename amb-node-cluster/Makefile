run: copy-spec start

copy-spec:
	cp ./amb/apollo0/chain.json ./amb/apollo1/chain.json && \
    cp ./amb/apollo0/chain.json ./amb/apollo2/chain.json && \
    cp ./amb/apollo0/chain.json ./amb/apollo3/chain.json && \
    cp ./amb/apollo0/chain.json ./amb/apollo4/chain.json && \
    cp ./amb/apollo0/chain.json ./amb/apollo5/chain.json && \
    cp ./amb/apollo0/chain.json ./amb/apollo6/chain.json && \
    cp ./amb/apollo0/chain.json ./amb/apollo7/chain.json && \
    cp ./amb/apollo0/chain.json ./amb/apollo8/chain.json && \
    cp ./amb/apollo0/chain.json ./amb/apollo9/chain.json && \
    cp ./amb/apollo0/chain.json ./amb/apollo10/chain.json


start:
	docker-compose up

stop:
	docker-compose down

clear:
	docker-compose down --volumes && \
	rm -rf ./amb/apollo0/chains && \
    rm -rf ./amb/apollo1/chains && \
    rm -rf ./amb/apollo2/chains && \
    rm -rf ./amb/apollo3/chains && \
    rm -rf ./amb/apollo4/chains && \
    rm -rf ./amb/apollo5/chains && \
    rm -rf ./amb/apollo6/chains && \
    rm -rf ./amb/apollo7/chains && \
    rm -rf ./amb/apollo8/chains && \
    rm -rf ./amb/apollo9/chains && \
    rm -rf ./amb/apollo10/chains && \
    docker-compose rm -f  && \
    docker volume prune -f
