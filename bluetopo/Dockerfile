# BlueTopo → hillshade MBTiles → PMTiles (SoCal AOI)
# Build:  docker build -t boatboard-bluetopo bluetopo
# Run:    docker run --rm -v "%CD%/bluetopo/out:/out" boatboard-bluetopo smoke
FROM ghcr.io/osgeo/gdal:ubuntu-small-3.9.2

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3-pip python3-venv curl ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*

# go-pmtiles CLI
ARG PMTILES_VERSION=1.28.0
RUN curl -fsSL -o /tmp/pmtiles.tgz \
      "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_x86_64.tar.gz" \
    && tar -xzf /tmp/pmtiles.tgz -C /usr/local/bin pmtiles \
    && chmod +x /usr/local/bin/pmtiles \
    && rm /tmp/pmtiles.tgz

RUN pip3 install --break-system-packages --no-cache-dir 'noaabathymetry>=0.3'

WORKDIR /work
COPY scripts/build.sh /work/build.sh
COPY aoi-smoke-palosverdes.geojson /work/aoi-smoke-palosverdes.geojson
COPY aoi-socal-daytrip.geojson /work/aoi-socal-daytrip.geojson
RUN chmod +x /work/build.sh

ENV AOI=smoke
VOLUME ["/out"]
ENTRYPOINT ["/work/build.sh"]
