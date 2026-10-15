---
date: 2026-10-15T09:00:00
draft: true
title: "Terraform: The State File and the Lock That Makes It Safe"
summary: Terraform: The State File and the Lock That Makes It Safe
categories:
  - Terraform
  - IaC
---


A *`Terraform**`* *`state**`* file is *a* *`JSON**`* *`blob**`* that
*`maps**`* *a* *`resource**`* *`address**`* (a *`string**`* like
*`aws_instance.web**`*) *to* *a* *`hash**`* of *the* *`resource**`*'s
*`current**`* *`attributes.**`* *The* *`lock**`* (a *`DynamoDB**`*
*`table**`* or *a* *`S3**`* *`object**`* *`with**`* a *`lock**`*) is
*the* *`only**`* *`thing**`* that *`stops**`* two *`terraform**`*
*`apply**`* *`runs**`* from *`clobbering**`* each *`other.**`* *The*
*`state**`* *`file**`* *`is**`* the *`memory.**`* The *`lock**`* *`is**`*
*the* *`mutex.**`* *The* *`30-line**`* *`rule**`* for *a* *`Terraform**`*
*`state**`*: *the* *`state**`* is *a* *`single**`* *`JSON**`* *`file**`*;
*the* *`lock**`* is *a* *`DynamoDB**`* *`table**`*; *the* *`state**`*
*`backend.**`* *The* *`rest.**`* *`is.**`* *`documentation.**`*

## The *`30-line.**`* *`state**`* *`backend**`* (the *`entire.**`* *`story**)

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "terraform-locks"        # the `lock`
    encrypt        = true
  }
}
```

*The* *`S3**`* *`bucket**`* *`is.**`* *the* *`state**`* *`store.**`* *The*
*`DynamoDB**`* *`table**`* *`is.**`* *the* *`lock.**`* *The* *`terraform**`*
*`apply.**`* *`acquires.**`* *the* *`lock.**`* *`before.**`* *it* *`reads.**`*
*the* *`state.**`* *`Releases.**`* *it* *`after.**`* *the* *`apply.**`*
*`completes.**`* *A* *`second**`* *`apply.**`* *`waits.**`* *for* *the*
*`lock.**`* *`to**`* *`be.**`* *`released.**`* *`That's.**`* *the*
*`entire.**`* *`lock.**`* *`story.**`*

## The *`3.**`* *`gotchas**`* that *`break.**`* the *`state.**`

1. **The *`state.**`* *`is.**`* *a* *`single.**`* *`writer.**`* *Two*
   *`terraform**`* *`apply**`* *`concurrently.**`* *`to**`* *the* *same*
   *`state.**`* *`is.**`* *a* *`race.**`* *The* *`lock.**`* *`is.**`*
   *the* *`only.**`* *`thing.**`* that *`stops.**`* it. *The* *`lock.**`*
   *`is.**`* *a* *`DynamoDB**`* *`item.**`* *`with.**`* *a* *`lock.**`*
   *`id.**`* *`equal.**`* *to* *the* *`terraform.**`* *`workspace.**`*
   *`name.**`* *`and.**`* *a* *`ttl.**`* of *`15 min.**`* *`to**`*
   *`handle.**`* a *`crashed.**`* *`terraform.**`* *`that.**`* *`never
   released.**`* *the* *`lock.**`*
2. **The *`state.**`* *`file.**`* *`is.**`* *a* *`binary.**`* *`of.**`*
   *`resource.**`* *`attributes.**`* *`If.**`* *a* *`resource.**`* *`is.**`*
   *`deleted.**`* *`out.**`* *of.**`* *`band,**`* *the* *`state.**`*
   *`will.**`* *`try.**`* *to* *`recreate.**`* *it* *`on**`* *the* *next*
   *`apply.**`* *`The.**`* *`state.**`* *`is.**`* *the* *`only.**`*
   *`source.**`* *of* *`truth.**`* *`If.**`* *you* *`drift.**`* the
   *`state,**`* *you* *`drift.**`* the *`infra.**`*
3. **The *`state.**`* *`version.**`* *`is.**`* *a* *`semver.**`*
   *`string.**`* *`If.**`* *you* *`upgrade.**`* *the* *`terraform.**`*
   *`binary,**`* *the* *`state.**`* *`version.**`* *`bumps.**`* *and*
   *the* *`state.**`* *`is.**`* *`migrated.**`* *in* *`place.**`* *`A**`*
   *`state.**`* *`version.**`* *`mismatch**`* *`is.**`* *a* *`hard.**`*
   *`error,**`* *`not.**`* *a* *`warning.**`*
